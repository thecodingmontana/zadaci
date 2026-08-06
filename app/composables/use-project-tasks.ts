import type { TaskDocType } from "~/plugins/rxdb.client";

export interface ProjectTasksSource {
  projectId: string | undefined;
  parentTaskId?: string | null;
}

export function useProjectTasks(source: () => ProjectTasksSource) {
  const tasks = ref<TaskDocType[]>([]);
  let sub: { unsubscribe: () => void } | null = null;

  const projectId = computed(() => source().projectId);
  const parentTaskId = computed(() => source().parentTaskId ?? null);

  async function subscribe() {
    const db = await useRxDbSafe();
    if (!db) return;
    sub?.unsubscribe();
    const pid = projectId.value;
    if (!pid) {
      tasks.value = [];
      return;
    }
    sub = db.tasks.find({ selector: { project_id: pid, deleted_at: null } }).$.subscribe((docs) => {
      tasks.value = docs;
    });
  }

  watch(projectId, subscribe, { immediate: true });

  onUnmounted(() => {
    sub?.unsubscribe();
  });

  const topLevelTasks = computed(() => {
    if (parentTaskId.value) {
      return tasks.value.filter((t) => t.parent_task_id === parentTaskId.value);
    }
    return tasks.value.filter((t) => !t.parent_task_id);
  });

  const subtasks = computed(() => {
    if (parentTaskId.value) {
      const ids = new Set(topLevelTasks.value.map((t) => t.id));
      return tasks.value.filter((t) => t.parent_task_id && ids.has(t.parent_task_id));
    }
    return tasks.value.filter((t) => t.parent_task_id);
  });

  const subtasksByParent = computed(() => {
    const map: Record<string, TaskDocType[]> = {};
    for (const sub of subtasks.value) {
      if (!sub.parent_task_id) continue;
      if (!map[sub.parent_task_id]) map[sub.parent_task_id] = [];
      map[sub.parent_task_id].push(sub);
    }
    return map;
  });

  const subtaskCounts = computed(() => {
    const counts: Record<string, { total: number; completed: number }> = {};
    for (const sub of subtasks.value) {
      if (!sub.parent_task_id) continue;
      if (!counts[sub.parent_task_id]) {
        counts[sub.parent_task_id] = { total: 0, completed: 0 };
      }
      counts[sub.parent_task_id].total++;
      if (sub.status === "completed") counts[sub.parent_task_id].completed++;
    }
    return counts;
  });

  return {
    tasks,
    topLevelTasks,
    subtasks,
    subtasksByParent,
    subtaskCounts,
  };
}
