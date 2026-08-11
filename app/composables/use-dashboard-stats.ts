import type { ProjectDocType, TaskActivityDocType, TaskDocType } from "~/plugins/rxdb.client";
import {
  addDays,
  endOfDay,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";

export interface StatTrend {
  value: number;
  delta: number;
  percent: number | null;
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
  };
}
