<script setup lang="ts">
import type { IDragEvent } from "@vue-dnd-kit/core";
import type { TaskColumns, TaskStatusKey } from "~/lib/task-kanban";
import type { TaskDocType } from "~/plugins/rxdb.client";
import KanbanColumn from "~/components/workspace/projects/tasks/kanban-column.vue";
import { useProjectTasks } from "~/composables/use-project-tasks";
import { useRxDbSafe } from "~/composables/use-rxdb";
import { groupTasksByStatus, STATUS_TO_API, TASK_STATUS_TO_RXDB } from "~/lib/task-kanban";
import { toast } from "~/lib/toast";
import { taskColumns } from "~/types";

const props = defineProps<{
  workspaceId: string;
  projectId: string;
  projectTitle: string;
  parentTaskId?: string | null;
}>();

const { topLevelTasks, subtaskCounts } = useProjectTasks(() => ({
  projectId: props.projectId,
  parentTaskId: props.parentTaskId,
}));

const columns = computed<TaskColumns>(() => groupTasksByStatus(topLevelTasks.value));

const statusKeyFromName = (name: string): TaskStatusKey =>
  name.toUpperCase().replace(/ /g, "_") as TaskStatusKey;

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
      `/api/workspace/${props.workspaceId}/project/${props.projectId}/tasks/${task.id}`,
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
        :project-id="projectId"
        :project-title="projectTitle"
        :parent-task-id="parentTaskId ?? null"
        @drop="handleDrop"
      />
    </div>
    <DragPreview />
  </DnDProvider>
</template>
