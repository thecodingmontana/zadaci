import type { ProjectDocType, TaskActivityDocType, TaskDocType } from "~/plugins/rxdb.client";
import { useQuery } from "@tanstack/vue-query";
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

  let projectSub: { unsubscribe: () => void } | null = null;
  let taskSub: { unsubscribe: () => void } | null = null;
  let activitySub: { unsubscribe: () => void } | null = null;

  function teardownSubs() {
    projectSub?.unsubscribe();
    taskSub?.unsubscribe();
    activitySub?.unsubscribe();
    projectSub = null;
    taskSub = null;
    activitySub = null;
  }

  function subscribeLive(db: Awaited<ReturnType<typeof useRxDbSafe>>, wsId: string) {
    if (!db) return;
    teardownSubs();

    projectSub = db.projects
      .find({ selector: { workspace_id: wsId, deleted_at: null } })
      .$.subscribe((docs) => {
        projects.value = docs;
      });

    // Re-derive task/activity subscriptions whenever the project set changes
    watch(
      projects,
      async (projs) => {
        taskSub?.unsubscribe();
        activitySub?.unsubscribe();

        const ids = projs.map((p) => p.id);
        if (ids.length === 0) {
          tasks.value = [];
          activities.value = [];
          return;
        }

        taskSub = db.tasks
          .find({ selector: { project_id: { $in: ids }, deleted_at: null } })
          .$.subscribe((docs) => {
            tasks.value = docs;
          });

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
      },
      { immediate: true },
    );
  }

  // ── TanStack Query owns the initial-load / loading / error lifecycle ──
  async function loadInitialData(wsId: string) {
    const db = await useRxDbSafe();
    if (!db) throw new Error("RxDB not ready");

    const projectDocs = await db.projects
      .find({ selector: { workspace_id: wsId, deleted_at: null } })
      .exec();
    projects.value = projectDocs;

    const projectIds = projectDocs.map((p) => p.id);
    const taskDocs = projectIds.length
      ? await db.tasks
          .find({ selector: { project_id: { $in: projectIds }, deleted_at: null } })
          .exec()
      : [];
    tasks.value = taskDocs;

    const taskIds = taskDocs.map((t) => t.id);
    activities.value = taskIds.length
      ? await db.tasks_activity
          .find({ selector: { task_id: { $in: taskIds }, deleted_at: null } })
          .exec()
      : [];

    // Hand off to live subscriptions once the first snapshot is in
    subscribeLive(db, wsId);

    return true;
  }

  const { isPending, isError, error, refetch } = useQuery({
    queryKey: computed(() => ["dashboard-stats", workspaceId()]),
    queryFn: () => loadInitialData(workspaceId()!),
    enabled: computed(() => !!workspaceId()),
    staleTime: Number.POSITIVE_INFINITY, // freshness after this comes from RxDB, not refetching
  });

  onUnmounted(teardownSubs);

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
    // TanStack Query-driven loading/error state
    loaded: computed(() => !isPending.value && !isError.value),
    isLoading: isPending,
    isError,
    error,
    refetch,

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
  };
}
