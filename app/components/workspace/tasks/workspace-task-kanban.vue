<script setup lang="ts">
import type { IDragEvent } from "@vue-dnd-kit/core";
import type { TaskColumns, TaskStatusKey } from "~/lib/task-kanban";
import type { TaskDocType } from "~/plugins/rxdb.client";
import KanbanColumn from "~/components/workspace/projects/tasks/kanban-column.vue";
import { useRxDbSafe } from "~/composables/use-rxdb";
import { useWorkspaceTasks } from "~/composables/use-workspace-tasks";
import { groupTasksByStatus, STATUS_TO_API, TASK_STATUS_TO_RXDB } from "~/lib/task-kanban";
import { toast } from "~/lib/toast";
import { taskColumns } from "~/types";

const props = defineProps<{
  workspaceId: string;
}>();

const { topLevelTasks, tasks } = useWorkspaceTasks(() => props.workspaceId);

const columns = computed<TaskColumns>(() => groupTasksByStatus(topLevelTasks.value));

const subtasksByParent = computed(() => {
  const map: Record<string, TaskDocType[]> = {};
  for (const task of tasks.value) {
    if (!task.parent_task_id) continue;
    if (!map[task.parent_task_id]) map[task.parent_task_id] = [];
    map[task.parent_task_id].push(task);
  }
  return map;
});

const subtaskCounts = computed(() => {
  const counts: Record<string, { total: number; completed: number }> = {};
  for (const [parentId, subs] of Object.entries(subtasksByParent.value)) {
    counts[parentId] = {
      total: subs.length,
      completed: subs.filter((s) => s.status === "completed").length,
    };
  }
  return counts;
});

const statusKeyFromName = (name: string): TaskStatusKey =>
  name.toUpperCase().replace(/ /g, "_") as TaskStatusKey;

const emptyProjectId = "";
const workspaceTasksTitle = "Workspace tasks";

async function handleDrop(columnKey: TaskStatusKey, event: IDragEvent) {
  const dragged = event.draggedItems?.[0];
  if (!dragged) return;
  const task = dragged.item as TaskDocType;
  if (!task) return;

  const newStatus = TASK_STATUS_TO_RXDB[columnKey];
  if (task.status === newStatus) return;

  const db = await useRxDbSafe();
  const doc = db ? await db.tasks.findOne(task.id).exec() : null;
  if (!doc) return;

  const old = doc.get("status");
  await doc.patch({ status: newStatus, updated_at: new Date().toISOString() });

  try {
    await $fetch(
      `/api/workspace/${props.workspaceId}/project/${task.project_id}/tasks/${task.id}`,
      {
        method: "PATCH",
        body: { status: STATUS_TO_API[columnKey] },
      },
    );
  } catch (err: any) {
    if (err?.response) {
      await doc.patch({ status: old, updated_at: new Date().toISOString() });
      toast.error(err?.response?._data?.statusMessage ?? "Failed to update task status", {
        position: "top-center",
      });
    }
  }
}
</script>

<template>
  <DnDProvider :auto-scroll-viewport="true">
    <div class="flex gap-4 overflow-x-auto pb-2">
      <KanbanColumn
        v-for="column in taskColumns"
        :key="column.name"
        :column="column"
        :status-key="statusKeyFromName(column.name)"
        :items="columns[statusKeyFromName(column.name)]"
        :subtask-counts="subtaskCounts"
        :workspace-id="workspaceId"
        :project-id="emptyProjectId"
        :project-title="workspaceTasksTitle"
        @drop="handleDrop"
      />
    </div>
    <DragPreview />
  </DnDProvider>
</template>
