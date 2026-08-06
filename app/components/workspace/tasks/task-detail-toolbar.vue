<script setup lang="ts">
import { useModalStore } from "~/stores/use-modal-store";

const props = defineProps<{
  workspaceId: string;
  projectId: string;
  projectTitle: string;
  parentTaskId: string;
}>();

const activeView = defineModel<string>("activeView", { default: "kanban" });
const searchQuery = defineModel<string>("searchQuery", { default: "" });

const views = [
  { value: "table", label: "Table", icon: "solar:widget-4-linear" },
  { value: "kanban", label: "Kanban", icon: "solar:widget-add-linear" },
  { value: "timeline", label: "Timeline", icon: "solar:chart-square-linear" },
] as const;

const modalStore = useModalStore();

function handleAddSubtask() {
  modalStore?.setModalData({
    workspaceId: props.workspaceId,
    projectId: props.projectId,
    projectTitle: props.projectTitle,
    parentTaskId: props.parentTaskId,
  });
  modalStore?.onOpen("addNewTask");
  modalStore?.setIsOpen(true);
}
</script>

<template>
  <Motion
    :initial="{ opacity: 0, y: 6 }"
    :animate="{ opacity: 1, y: 0 }"
    :transition="{ duration: 0.3, delay: 0.2 }"
    class="flex items-center justify-between"
  >
    <Tabs v-model="activeView">
      <TabsList>
        <TabsTrigger v-for="view in views" :key="view.value" :value="view.value" class="gap-1.5">
          <Icon :name="view.icon" class="size-4" />
          {{ view.label }}
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <div class="flex items-center gap-2">
      <div class="relative">
        <Icon
          name="solar:magnifier-linear"
          class="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input v-model="searchQuery" placeholder="Search subtasks" class="w-56 pl-8" />
      </div>
      <Button variant="outline" size="sm" class="gap-1.5">
        <Icon name="solar:tuning-2-linear" class="size-4" />
        Filter
      </Button>
      <Button variant="outline" size="sm" class="gap-1.5">
        <Icon name="solar:sort-vertical-linear" class="size-4" />
        Sort
      </Button>
      <Button size="sm" class="gap-1.5 bg-brand hover:bg-brand-secondary" @click="handleAddSubtask">
        <Icon name="solar:add-circle-linear" class="size-4" />
        Add Subtask
      </Button>
    </div>
  </Motion>
</template>
