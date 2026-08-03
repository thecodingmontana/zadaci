<script setup lang="ts">
import AddNewTaskForm from "~/components/workspace/projects/add-new-task-form.vue";
import { useModalStore } from "~/stores/use-modal-store";

const modalStore = useModalStore();

const isAddNewTask = ref(false);

const isModalOpen = computed(() => {
  return modalStore?.type === "addNewTask" && modalStore?.isOpen;
});

const projectId = computed(() => modalStore?.data?.projectId ?? null);
const projectTitle = computed(() => modalStore?.data?.projectTitle ?? null);

const onSetIsAddNewTask = (payload: boolean) => {
  isAddNewTask.value = payload;
};

const onClose = () => {
  if (!isAddNewTask.value) {
    modalStore?.setIsOpen(false);
    modalStore?.onClose();
    modalStore?.setModalData({});
  }
};
</script>

<template>
  <Sheet :open="isModalOpen" @update:open="onClose">
    <SheetContent
      class="m-0 flex h-screen w-full flex-col border-0 p-0 shadow-2xl sm:m-2 sm:h-[calc(100vh-1rem)] sm:max-w-sm sm:rounded-xl dark:bg-[#1d1d1d]"
    >
      <SheetHeader>
        <SheetTitle
          class="flex items-center gap-x-2 text-xl text-brand capitalize dark:text-primary"
        >
          <div class="size-10 rounded-md bg-muted p-2">
            <Icon name="hugeicons:task-02" size="25" />
          </div>
          <div class="flex flex-col">
            <span>Add new task</span>
            <span v-if="projectTitle" class="text-sm font-normal text-muted-foreground">
              {{ projectTitle }}
            </span>
          </div>
        </SheetTitle>
        <SheetDescription class="sr-only"> Add new task </SheetDescription>
      </SheetHeader>
      <AddNewTaskForm
        :on-close="onClose"
        :is-add-new-task="isAddNewTask"
        :on-set-is-add-new-task="onSetIsAddNewTask"
        :project-id="projectId"
      />
    </SheetContent>
  </Sheet>
</template>
