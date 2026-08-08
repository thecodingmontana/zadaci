<script setup lang="ts">
import type { IDragEvent } from "@vue-dnd-kit/core";
import type { TaskColumns, TaskStatusKey } from "~/lib/task-kanban";
import type { ProjectDocType } from "~/plugins/rxdb.client";
import ProjectKanbanColumn from "~/components/workspace/projects/project-kanban-column.vue";
import { useRxDbSafe } from "~/composables/use-rxdb";
import { useWorkspaceProjects } from "~/composables/use-workspace-projects";
import { STATUS_TO_API, statusToColumnKey, TASK_STATUS_TO_RXDB } from "~/lib/task-kanban";
import { toast } from "~/lib/toast";
import { columns as projectColumns } from "~/types";

const props = defineProps<{
  workspaceId: string;
}>();

const { activeProjects } = useWorkspaceProjects(() => props.workspaceId);

const grouped = computed<TaskColumns>(() => {
  const result = {
    IDEA: [] as ProjectDocType[],
    TODO: [] as ProjectDocType[],
    IN_PROGRESS: [] as ProjectDocType[],
    IN_REVIEW: [] as ProjectDocType[],
    COMPLETED: [] as ProjectDocType[],
    ABANDONED: [] as ProjectDocType[],
  };
  for (const project of activeProjects.value) {
    const key = statusToColumnKey(project.status);
    if (result[key]) result[key].push(project);
  }
  return result;
});

const statusKeyFromName = (name: string): TaskStatusKey =>
  name.toUpperCase().replace(/ /g, "_") as TaskStatusKey;

async function handleDrop(columnKey: TaskStatusKey, event: IDragEvent) {
  const dragged = event.draggedItems?.[0];
  if (!dragged) return;
  const project = dragged.item as ProjectDocType;
  if (!project) return;

  const newStatus = TASK_STATUS_TO_RXDB[columnKey];
  if (project.status === newStatus) return;

  const db = await useRxDbSafe();
  const doc = db ? await db.projects.findOne(project.id).exec() : null;
  if (!doc) return;

  const old = doc.get("status");
  await doc.patch({ status: newStatus, updated_at: new Date().toISOString() });

  try {
    await $fetch(`/api/workspace/${props.workspaceId}/project/${project.id}/update-status`, {
      method: "PATCH",
      body: { status: STATUS_TO_API[columnKey] },
    });
  } catch (err: any) {
    if (err?.response) {
      await doc.patch({ status: old, updated_at: new Date().toISOString() });
      toast.error(err?.response?._data?.statusMessage ?? "Failed to update project status", {
        position: "top-center",
      });
    }
  }
}
</script>

<template>
  <DnDProvider :auto-scroll-viewport="true">
    <div class="flex gap-4 overflow-x-auto pb-2">
      <ProjectKanbanColumn
        v-for="column in projectColumns"
        :key="column.name"
        :column="column"
        :status-key="statusKeyFromName(column.name)"
        :items="grouped[statusKeyFromName(column.name)]"
        :workspace-id="workspaceId"
        @drop="handleDrop"
      />
    </div>
    <DragPreview />
  </DnDProvider>
</template>
