import type { TaskDocType } from "~/plugins/rxdb.client";

export function useWorkspaceTasks(workspaceId: () => string | undefined) {
  const tasks = ref<TaskDocType[]>([]);
  const projectIds = ref<string[]>([]);
  let projectSub: { unsubscribe: () => void } | null = null;
  let taskSub: { unsubscribe: () => void } | null = null;

  async function subscribeProjects() {
    const db = await useRxDbSafe();
    projectSub?.unsubscribe();
    if (!db) return;
    const wsId = workspaceId();
    if (!wsId) {
      projectIds.value = [];
      return;
    }
    projectSub = db.projects
      .find({
        selector: { workspace_id: wsId, deleted_at: null },
      })
      .$.subscribe((docs) => {
        projectIds.value = docs.map((p) => p.id);
      });
  }

  async function subscribeTasks() {
    const db = await useRxDbSafe();
    taskSub?.unsubscribe();
    if (!db) return;
    const ids = projectIds.value;
    if (ids.length === 0) {
      tasks.value = [];
      return;
    }
    taskSub = db.tasks
      .find({
        selector: { project_id: { $in: ids }, deleted_at: null },
      })
      .$.subscribe((docs) => {
        tasks.value = docs;
      });
  }

  watch(projectIds, subscribeTasks, { immediate: false });

  watch(
    workspaceId,
    async (wsId) => {
      if (wsId) subscribeProjects();
    },
    { immediate: true },
  );

  onUnmounted(() => {
    projectSub?.unsubscribe();
    taskSub?.unsubscribe();
  });

  const topLevelTasks = computed(() => tasks.value.filter((t) => !t.parent_task_id));

  return { tasks, topLevelTasks, projectIds };
}
