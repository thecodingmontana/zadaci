<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import CreateChannelForm from "~/components/workspace/forms/create-channel-form.vue";
import { useModalStore } from "~/stores/use-modal-store";

const modalStore = useModalStore();

const isModalOpen = computed(() => {
  return modalStore?.type === "createChannel" && modalStore?.isOpen;
});

const onClose = () => {
  modalStore?.setIsOpen(false);
  modalStore?.onClose();
};
</script>

<template>
  <AlertDialog :open="isModalOpen" @update:open="onClose">
    <AlertDialogContent class="dark:bg-[#1d1d1d]">
      <AlertDialogHeader>
        <div class="flex items-center gap-x-2">
          <div class="mt-1 grid shrink-0 place-items-center self-start rounded-full">
            <Icon name="lucide:hash" class="text-brand" size="25" />
          </div>
          <div class="grid gap-0.5 self-start">
            <AlertDialogTitle class="text-brand"> Create a new Channel </AlertDialogTitle>
            <AlertDialogDescription>
              Channels organize your team's conversations. Choose a name and set visibility to get
              started.
            </AlertDialogDescription>
          </div>
        </div>
      </AlertDialogHeader>
      <CreateChannelForm />
    </AlertDialogContent>
  </AlertDialog>
</template>
