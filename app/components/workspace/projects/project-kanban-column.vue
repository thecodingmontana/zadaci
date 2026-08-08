<script setup lang="ts">
import type { IDragEvent } from "@vue-dnd-kit/core";
import type { ProjectDocType } from "~/plugins/rxdb.client";
import type { IProjectColumn } from "~/types";
import { makeDroppable } from "@vue-dnd-kit/core";
import { useTemplateRef } from "vue";
import { ScrollArea } from "~/components/ui/scroll-area";
import ProjectKanbanCard from "~/components/workspace/projects/project-kanban-card.vue";
import { useModalStore } from "~/stores/use-modal-store";

const props = defineProps<{
  column: IProjectColumn;
  statusKey: string;
  items: ProjectDocType[];
  workspaceId: string;
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

function openProject(projectId: string) {
  navigateTo(`/workspace/${props.workspaceId}/projects/${projectId}`);
}

function addProject() {
  modalStore?.setModalData({
    workspaceId: props.workspaceId,
    projectStatus: props.statusKey,
  });
  modalStore?.onOpen("addNewProject");
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
        aria-label="Add project"
        @click="addProject"
      >
        <Icon name="lucide:plus" class="size-4" />
      </span>
    </div>

    <p class="px-3 pb-2 text-xs text-muted-foreground italic">{{ column.description }}</p>

    <ScrollArea class="max-h-[560px] flex-1 overflow-y-auto px-2 pb-2">
      <div class="space-y-2">
        <ProjectKanbanCard
          v-for="(project, index) in items"
          :key="project.id"
          :project="project"
          :index="index"
          :items="items"
          @open="openProject"
        />
        <div
          v-if="isDragOver && isAllowed && items.length === 0"
          class="rounded-md bg-background/50 p-9 text-center text-sm font-medium"
        />
      </div>
    </ScrollArea>
  </div>
</template>
