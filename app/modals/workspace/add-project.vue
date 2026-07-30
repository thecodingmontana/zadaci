<script setup lang="ts">
import AddNewProjectForm from "~/components/workspace/projects/add-new-project-form.vue";
import { useModalStore } from "~/stores/use-modal-store";

const modalStore = useModalStore();

const isAddNewProject = ref(false);

const isModalOpen = computed(() => {
  return modalStore?.type === "addNewProject" && modalStore?.isOpen;
});

const onSetIsAddNewProject = (payload: boolean) => {
  isAddNewProject.value = payload;
};

const onClose = () => {
  if (!isAddNewProject.value) {
    modalStore?.setIsOpen(false);
    modalStore?.onClose();
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
            <Icon name="solar:folder-with-files-outline" size="25" />
          </div>
          Add new project
        </SheetTitle>
        <SheetDescription class="sr-only"> Add new project </SheetDescription>
      </SheetHeader>
      <AddNewProjectForm
        :on-close="onClose"
        :is-add-new-project="isAddNewProject"
        :on-set-is-add-new-project="onSetIsAddNewProject"
      />
    </SheetContent>
  </Sheet>
</template>
