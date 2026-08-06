import type { TaskDocType } from "~/plugins/rxdb.client";

export function useProjectTasks(projectId: () => string | undefined) {
  const tasks = ref<TaskDocType[]>([]);
  const subtaskCounts = ref<Record<string, { total: number; completed: number }>>({});
  const subs: { unsubscribe: () => void }[] = [];

  onUnmounted(() => {
    for (const s of subs) s.unsubscribe();
  });

  async function init() {
    if (import.meta.server) return;
    const db = await useRxDbSafe();
    if (!db) return;

    subs.push(
      db.tasks
        .find({ selector: { project_id: projectId(), deleted_at: null } })
        .$.subscribe((docs) => {
          tasks.value = docs;
        }),
    );

    subs.push(
      db.tasks
        .find({
          selector: { project_id: projectId(), parent_task_id: { $ne: null }, deleted_at: null },
        })
        .$.subscribe((docs) => {
          const counts: Record<string, { total: number; completed: number }> = {};
          for (const sub of docs) {
            if (!sub.parent_task_id) continue;
            if (!counts[sub.parent_task_id]) {
              counts[sub.parent_task_id] = { total: 0, completed: 0 };
            }
            counts[sub.parent_task_id].total++;
            if (sub.status === "completed") counts[sub.parent_task_id].completed++;
          }
          subtaskCounts.value = counts;
        }),
    );
  }

  init();

  const topLevelTasks = computed(() => tasks.value.filter((t) => !t.parent_task_id));

  const subtasks = computed(() => tasks.value.filter((t) => t.parent_task_id));

  const subtasksByParent = computed(() => {
    const map: Record<string, TaskDocType[]> = {};
    for (const sub of subtasks.value) {
      if (!sub.parent_task_id) continue;
      if (!map[sub.parent_task_id]) map[sub.parent_task_id] = [];
      map[sub.parent_task_id].push(sub);
    }
    return map;
  });

  return {
    tasks,
    topLevelTasks,
    subtasks,
    subtasksByParent,
    subtaskCounts,
  };
}
