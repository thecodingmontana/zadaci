import type { ProjectDocType, TaskDocType } from "~/plugins/rxdb.client";
import { format } from "date-fns";

export function useProjectDetail(projectId: string) {
  const project = ref<ProjectDocType | null>(null);
  const tasks = ref<TaskDocType[]>([]);

  console.log("[useProjectDetail] init for projectId:", projectId);

  const statusStyles: Record<string, { label: string; dot: string; text: string; bg: string }> = {
    idea: {
      label: "Idea",
      dot: "bg-gray-500",
      text: "text-gray-700 dark:text-gray-400",
      bg: "bg-gray-50 dark:bg-gray-500/10",
    },
    todo: {
      label: "Todo",
      dot: "bg-blue-500",
      text: "text-blue-700 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-500/10",
    },
    in_progress: {
      label: "In progress",
      dot: "bg-amber-500",
      text: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-500/10",
    },
    in_review: {
      label: "In review",
      dot: "bg-purple-500",
      text: "text-purple-700 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-500/10",
    },
    completed: {
      label: "Done",
      dot: "bg-green-500",
      text: "text-green-700 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-500/10",
    },
    abandoned: {
      label: "Abandoned",
      dot: "bg-red-500",
      text: "text-red-700 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-500/10",
    },
  };

  const currentStatus = computed(() => {
    const s = project.value?.status ?? "idea";
    return statusStyles[s] ?? statusStyles.idea;
  });

  const timeline = computed(() => {
    const created = project.value?.created_at;
    const due = project.value?.due_date;
    return {
      start: created ? format(new Date(created), "MMM d") : "—",
      end: due ? format(new Date(due), "MMM d") : "—",
    };
  });

  const milestones = computed(() => {
    const all = tasks.value.filter((t) => t.project_id === projectId && !t.deleted_at);
    const completedCount = all.filter(
      (t) => t.status === "completed" || t.status === "abandoned",
    ).length;
    return { completed: completedCount, total: all.length };
  });

  const milestoneProgress = computed(() => {
    if (milestones.value.total === 0) return 0;
    return (milestones.value.completed / milestones.value.total) * 100;
  });

  const subs: { unsubscribe: () => void }[] = [];

  onUnmounted(() => {
    for (const s of subs) s.unsubscribe();
  });

  async function init() {
    if (import.meta.server) return;
    console.log("[useProjectDetail] init() — waiting for RxDB...");
    const db = await useRxDbSafe();
    if (!db) {
      console.warn("[useProjectDetail] RxDB not available");
      return;
    }
    console.log("[useProjectDetail] RxDB ready, subscribing to project:", projectId);

    subs.push(
      db.projects.findOne(projectId).$.subscribe((doc) => {
        console.log("[useProjectDetail] project doc received:", doc?.id, doc?.title, doc?.status);
        project.value = doc ?? null;
      }),
    );

    subs.push(
      db.tasks
        .find({ selector: { project_id: projectId, deleted_at: null } })
        .$.subscribe((docs) => {
          console.log("[useProjectDetail] tasks received:", docs.length);
          tasks.value = docs;
        }),
    );

    console.log("[useProjectDetail] subscriptions active");
  }

  init();

  return {
    project,
    tasks,
    currentStatus,
    timeline,
    milestones,
    milestoneProgress,
  };
}
