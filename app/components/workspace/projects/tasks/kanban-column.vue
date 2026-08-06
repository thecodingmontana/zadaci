<script setup lang="ts">
import type { IDragEvent } from "@vue-dnd-kit/core";
import type { TaskDocType } from "~/plugins/rxdb.client";
import type { IProjectColumn } from "~/types";
import { makeDroppable } from "@vue-dnd-kit/core";
import { useTemplateRef } from "vue";
import { ScrollArea } from "~/components/ui/scroll-area";
import KanbanTaskCard from "~/components/workspace/projects/tasks/kanban-task-card.vue";
import { useModalStore } from "~/stores/use-modal-store";

const props = defineProps<{
  column: IProjectColumn;
  statusKey: string;
  items: TaskDocType[];
  subtaskCounts: Record<string, { total: number; completed: number }>;
  workspaceId: string;
  projectId: string;
  projectTitle: string;
  parentTaskId?: string | null;
}>();

const emit = defineEmits<{
  drop: [columnKey: string, event: IDragEvent];
}>();

const zoneRef = useTemplateRef<HTMLElement>("zone");

const { isDragOver, isAllowed } = makeDroppable(
  zoneRef,
  {
    events: {
      onDrop: (e: IDragEvent) => emit("drop", props.statusKey, e),
    },
  },
  () => props.items,
);

const modalStore = useModalStore();

function openTask(taskId: string) {
  navigateTo(`/workspace/${props.workspaceId}/tasks/${taskId}`);
}

function addTask() {
  modalStore?.setModalData({
    workspaceId: props.workspaceId,
    projectId: props.projectId,
    projectTitle: props.projectTitle,
    taskStatus: props.statusKey,
    parentTaskId: props.parentTaskId ?? undefined,
  });
  modalStore?.onOpen("addNewTask");
  modalStore?.setIsOpen(true);
}
</script>

<template>
  <div
    ref="zone"
    class="flex h-full w-[320px] flex-shrink-0 flex-col self-start rounded-lg bg-muted/60"
    :class="{
      'ring-2 ring-primary/50': isDragOver && isAllowed,
    }"
  >
    <div class="flex items-center justify-between px-3 py-2.5">
      <div class="flex items-center gap-2">
        <Icon :name="column.icon" class="size-4 text-muted-foreground" />
        <span class="text-sm font-medium">{{ column.name }}</span>
        <span class="text-xs text-muted-foreground">{{ items.length }}</span>
      </div>
      <span
        class="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
        role="button"
        tabindex="0"
        aria-label="Add task"
        @click="addTask"
      >
        <Icon name="lucide:plus" class="size-4" />
      </span>
    </div>

    <p class="px-3 pb-2 text-xs text-muted-foreground italic">{{ column.description }}</p>

    <ScrollArea class="max-h-[560px] flex-1 overflow-y-auto px-2 pb-2">
      <div class="space-y-2">
        <KanbanTaskCard
          v-for="(task, index) in items"
          :key="task.id"
          :task="task"
          :index="index"
          :items="items"
          :subtask-count="subtaskCounts[task.id]"
          @open="openTask"
        />
        <div
          v-if="isDragOver && isAllowed && items.length === 0"
          class="rounded-md bg-background/50 p-9 text-center text-sm font-medium"
        />
      </div>
    </ScrollArea>
  </div>
</template>
