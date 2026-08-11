import type { ProjectDocType, TaskActivityDocType, TaskDocType } from "~/plugins/rxdb.client";
import {
  addDays,
  endOfDay,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";

export interface StatTrend {
  value: number;
  delta: number;
  percent: number | null;
}

export interface DayContribution {
  date: string;
  count: number;
}

export interface ProductivityDay {
  day: string;
  completed: number;
  overdue: number;
  productivityPct: number;
}

const NOT_DONE = new Set(["idea", "todo", "in_progress", "in_review"]);

export function useDashboardStats(workspaceId: () => string | undefined) {
  const projects = ref<ProjectDocType[]>([]);
  const tasks = ref<TaskDocType[]>([]);
  const activities = ref<TaskActivityDocType[]>([]);
  const loaded = ref(false);
  let projectSub: { unsubscribe: () => void } | null = null;
  let taskSub: { unsubscribe: () => void } | null = null;
  let activitySub: { unsubscribe: () => void } | null = null;

  async function subscribeProjects() {
    const db = await useRxDbSafe();
    projectSub?.unsubscribe();
    if (!db) return;
    const wsId = workspaceId();
    if (!wsId) {
      projects.value = [];
      return;
    }
    projectSub = db.projects
      .find({ selector: { workspace_id: wsId, deleted_at: null } })
      .$.subscribe((docs) => {
        projects.value = docs;
        loaded.value = true;
      });
  }

  async function subscribeTasks() {
    const db = await useRxDbSafe();
    taskSub?.unsubscribe();
    if (!db) return;
    const ids = projects.value.map((p) => p.id);
    if (ids.length === 0) {
      tasks.value = [];
      return;
    }
    taskSub = db.tasks
      .find({ selector: { project_id: { $in: ids }, deleted_at: null } })
      .$.subscribe((docs) => {
        tasks.value = docs;
      });
  }

  async function subscribeActivities() {
    const db = await useRxDbSafe();
    activitySub?.unsubscribe();
    if (!db) return;
    const ids = projects.value.map((p) => p.id);
    if (ids.length === 0) {
      activities.value = [];
      return;
    }
    const taskDocs = await db.tasks
      .find({ selector: { project_id: { $in: ids }, deleted_at: null } })
      .exec();
    const taskIds = taskDocs.map((t) => t.id);
    if (taskIds.length === 0) {
      activities.value = [];
      return;
    }
    activitySub = db.tasks_activity
      .find({ selector: { task_id: { $in: taskIds }, deleted_at: null } })
      .$.subscribe((docs) => {
        activities.value = docs;
      });
  }

  watch(projects, subscribeTasks, { immediate: false });
  watch(projects, subscribeActivities, { immediate: false });

  watch(
    workspaceId,
    async (wsId) => {
      if (wsId) {
        await subscribeProjects();
      } else {
        projects.value = [];
        tasks.value = [];
        activities.value = [];
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    projectSub?.unsubscribe();
    taskSub?.unsubscribe();
    activitySub?.unsubscribe();
  });

  const topLevelTasks = computed(() => tasks.value.filter((t) => !t.parent_task_id));

  // ── Stat counts (from live RxDB data) ──
  const activeProjects = computed(
    () => projects.value.filter((p) => NOT_DONE.has(p.status)).length,
  );

  const completedTasks = computed(
    () => topLevelTasks.value.filter((t) => t.status === "completed").length,
  );
  const pendingTasks = computed(
    () => topLevelTasks.value.filter((t) => NOT_DONE.has(t.status)).length,
  );

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekAhead = endOfDay(addDays(now, 7));

  const upcomingDeadlines = computed(
    () =>
      topLevelTasks.value.filter((t) => {
        if (!t.due_date || !NOT_DONE.has(t.status)) return false;
        const due = parseISO(t.due_date);
        return isAfter(due, todayStart) && isBefore(due, weekAhead);
      }).length,
  );

  const overdueTasks = computed(
    () =>
      topLevelTasks.value.filter((t) => {
        if (!t.due_date || !NOT_DONE.has(t.status)) return false;
        return isBefore(parseISO(t.due_date), todayStart);
      }).length,
  );

  // ── Trends vs last month ──
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));

  const completedEventsThisMonth = computed(
    () =>
      activities.value.filter((a) => {
        if (a.status !== "completed") return false;
        const d = parseISO(a.changed_at);
        return d >= thisMonthStart && d <= now;
      }).length,
  );

  const completedEventsLastMonth = computed(
    () =>
      activities.value.filter((a) => {
        if (a.status !== "completed") return false;
        const d = parseISO(a.changed_at);
        return d >= lastMonthStart && d < thisMonthStart;
      }).length,
  );

  const createdThisMonth = computed(
    () =>
      topLevelTasks.value.filter((t) => {
        const d = parseISO(t.created_at);
        return d >= thisMonthStart && d <= now;
      }).length,
  );

  const createdLastMonth = computed(
    () =>
      topLevelTasks.value.filter((t) => {
        const d = parseISO(t.created_at);
        return d >= lastMonthStart && d < thisMonthStart;
      }).length,
  );

  const projectsCreatedThisMonth = computed(
    () =>
      projects.value.filter((p) => {
        const d = parseISO(p.created_at);
        return d >= thisMonthStart && d <= now;
      }).length,
  );

  const projectsCreatedLastMonth = computed(
    () =>
      projects.value.filter((p) => {
        const d = parseISO(p.created_at);
        return d >= lastMonthStart && d < thisMonthStart;
      }).length,
  );

  function buildTrend(current: number, previous: number): StatTrend {
    const delta = current - previous;
    let percent: number | null = null;
    if (previous > 0) {
      percent = Math.round((delta / previous) * 1000) / 10;
    }
    return { value: current, delta, percent };
  }

  const completedTrend = computed(() =>
    buildTrend(completedEventsThisMonth.value, completedEventsLastMonth.value),
  );
  const pendingTrend = computed(() => buildTrend(createdThisMonth.value, createdLastMonth.value));
  const activeProjectTrend = computed(() =>
    buildTrend(projectsCreatedThisMonth.value, projectsCreatedLastMonth.value),
  );

  // ── Productivity trend (completed this month vs last month) ──
  const productivityTrend = computed(() =>
    buildTrend(completedEventsThisMonth.value, completedEventsLastMonth.value),
  );

  // ── Productivity series (completed per day for a month) ──
  const productivityMonth = ref(startOfMonth(now));

  const productivitySeries = computed<ProductivityDay[]>(() => {
    const start = startOfMonth(productivityMonth.value);
    const end = endOfMonth(productivityMonth.value);
    const tasksForMonth = topLevelTasks.value.filter((t) => {
      if (!t.due_date) return false;
      return parseISO(t.due_date) <= end;
    });
    const completedByDay = new Map<string, number>();
    const overdueSet = new Set<string>();
    for (const a of activities.value) {
      if (a.status !== "completed") continue;
      const d = parseISO(a.changed_at);
      if (d < start || d > end) continue;
      const key = format(d, "yyyy-MM-dd");
      completedByDay.set(key, (completedByDay.get(key) ?? 0) + 1);
      overdueSet.add(a.task_id);
    }
    const days: ProductivityDay[] = [];
    let cursor = start;
    while (cursor <= end) {
      const key = format(cursor, "yyyy-MM-dd");
      const dayCompleted = completedByDay.get(key) ?? 0;
      const overdue = tasksForMonth.filter((t) => {
        const due = format(parseISO(t.due_date!), "yyyy-MM-dd");
        if (due > key) return false;
        if (overdueSet.has(t.id)) return false;
        return !t.updated_at || parseISO(t.updated_at) > cursor;
      }).length;
      const baseline = dayCompleted + overdue;
      const productivityPct = baseline > 0 ? Math.round((dayCompleted / baseline) * 100) : 0;
      days.push({ day: key, completed: dayCompleted, overdue, productivityPct });
      cursor = addDays(cursor, 1);
    }
    return days;
  });

  const productivityTotal = computed(() =>
    productivitySeries.value.reduce((sum, d) => sum + d.completed, 0),
  );
  const productivityAvg = computed(() =>
    productivitySeries.value.length
      ? Math.round((productivityTotal.value / productivitySeries.value.length) * 10) / 10
      : 0,
  );

  function shiftProductivityMonth(delta: number) {
    productivityMonth.value = new Date(
      productivityMonth.value.getFullYear(),
      productivityMonth.value.getMonth() + delta,
      1,
    );
  }

  // ── Contribution grid (completed per day, per current user, last 365 days) ──
  const { user } = useUserSession();
  const { data: members } = useWorkspaceMembers(computed(() => workspaceId()));

  const currentMemberId = computed(() => {
    const uid = user.value?.id;
    if (!uid || !members.value) return null;
    const m = (members.value as any[]).find((member) => member.userId === uid);
    return m?.id ?? null;
  });

  const contributionWeeks = ref(53);

  const contributions = computed<DayContribution[]>(() => {
    const memberId = currentMemberId.value;
    if (!memberId) return [];
    const today = startOfDay(now);
    const start = startOfWeek(subMonths(today, 11), { weekStartsOn: 1 });
    const map = new Map<string, number>();
    for (const a of activities.value) {
      if (a.status !== "completed" || a.changed_by !== memberId) continue;
      const d = parseISO(a.changed_at);
      if (d < start || d > today) continue;
      const key = format(d, "yyyy-MM-dd");
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const days: DayContribution[] = [];
    let cursor = start;
    while (cursor <= today) {
      const key = format(cursor, "yyyy-MM-dd");
      days.push({ date: key, count: map.get(key) ?? 0 });
      cursor = addDays(cursor, 1);
    }
    return days;
  });

  const totalContributions = computed(() =>
    contributions.value.reduce((sum, d) => sum + d.count, 0),
  );

  return {
    loaded,
    projects,
    tasks,
    topLevelTasks,
    activeProjects,
    completedTasks,
    pendingTasks,
    upcomingDeadlines,
    overdueTasks,
    completedTrend,
    pendingTrend,
    activeProjectTrend,
    productivityTrend,
    productivityMonth,
    productivitySeries,
    productivityTotal,
    productivityAvg,
    shiftProductivityMonth,
    contributions,
    totalContributions,
    contributionWeeks,
    currentMemberId,
  };
}
