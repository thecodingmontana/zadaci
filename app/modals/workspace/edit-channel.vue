<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import EditChannelForm from "~/components/workspace/forms/edit-channel-form.vue";
import { useModalStore } from "~/stores/use-modal-store";

const modalStore = useModalStore();

const isModalOpen = computed(() => {
  return modalStore?.type === "editChannel" && modalStore?.isOpen;
});

const channelId = computed(() => {
  return modalStore?.data?.channelId ?? "";
});

const channelName = computed(() => {
  return modalStore?.data?.channelName ?? "";
});

const channelType = computed(() => {
  return modalStore?.data?.channelType ?? "public";
});

watch(isModalOpen, (open) => {
  console.log("[edit-channel wrapper] isModalOpen:", open, {
    channelId: channelId.value,
    channelName: channelName.value,
    channelType: channelType.value,
  });
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
            <Icon name="lucide:settings" class="text-brand" size="25" />
          </div>
          <div class="grid gap-0.5 self-start">
            <AlertDialogTitle class="text-brand"> Edit Channel </AlertDialogTitle>
            <AlertDialogDescription>
              Update the channel name or visibility.
            </AlertDialogDescription>
          </div>
        </div>
      </AlertDialogHeader>
      <EditChannelForm
        v-if="isModalOpen"
        :key="channelId"
        :channel-name="channelName"
        :channel-type="channelType"
      />
    </AlertDialogContent>
  </AlertDialog>
</template>
