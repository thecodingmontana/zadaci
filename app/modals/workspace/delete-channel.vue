<script setup lang="ts">
import { Loader } from "@lucide/vue";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { useRxDbSafe } from "~/composables/use-rxdb";
import { toast } from "~/lib/toast";
import { cn } from "~/lib/utils";
import { useModalStore } from "~/stores/use-modal-store";

const modalStore = useModalStore();

const isModalOpen = computed(() => {
  return modalStore?.type === "deleteChannel" && modalStore?.isOpen;
});

const channelId = computed(() => modalStore?.data?.channelId);
const channelName = computed(() => modalStore?.data?.channelName);

const isDeleting = ref(false);

function onClose() {
  modalStore?.setIsOpen(false);
  modalStore?.onClose();
}

async function onDelete() {
  if (!channelId.value) return;
  isDeleting.value = true;

  const promise = $fetch(`/api/channels/${channelId.value}`, {
    method: "DELETE",
  });

  toast.promise(promise, {
    loading: "Deleting channel...",
    success: `#${channelName.value} channel deleted`,
    error: (err: any) =>
      err?.response?._data?.statusMessage ?? err?.message ?? "Couldn't delete channel",
    errorDesc: "Try again later",
    position: "top-center",
  });

  promise
    .then(async () => {
      const db = await useRxDbSafe();
      if (db) {
        const doc = await db.channels.findOne(channelId.value!).exec();
        if (doc) {
          await doc.patch({
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
      onClose();
    })
    .catch(() => {})
    .finally(() => {
      isDeleting.value = false;
    });
}
</script>

<template>
  <AlertDialog :open="isModalOpen" @update:open="onClose">
    <AlertDialogContent class="dark:bg-[#1d1d1d]">
      <AlertDialogHeader>
        <div class="flex items-center gap-x-2">
          <div class="mt-1 grid shrink-0 place-items-center self-start rounded-full">
            <Icon name="lucide:trash-2" class="text-red-500" size="25" />
          </div>
          <div class="grid gap-0.5 self-start">
            <AlertDialogTitle class="text-brand"> Delete #{{ channelName }} </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the <strong>#{{ channelName }}</strong> channel and all
              its messages. This action cannot be undone.
            </AlertDialogDescription>
          </div>
        </div>
      </AlertDialogHeader>
      <div class="flex flex-col items-center gap-2 pt-2">
        <button
          type="button"
          :disabled="isDeleting"
          :class="
            cn(
              'flex w-full items-center justify-center gap-1.5 rounded px-5 py-2 text-sm font-medium whitespace-nowrap text-white transition-all',
              'cursor-pointer bg-red-600 hover:bg-red-700',
              isDeleting && 'cursor-not-allowed opacity-50',
            )
          "
          @click="onDelete"
        >
          <Loader v-if="isDeleting" class="size-5 animate-spin" />
          <Icon v-else name="lucide:trash-2" class="size-4" />
          Delete Channel
        </button>
        <Button
          type="button"
          :disabled="isDeleting"
          variant="ghost"
          class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded px-5 py-2 text-sm font-medium whitespace-nowrap transition-all"
          @click="onClose"
        >
          Cancel
        </Button>
      </div>
    </AlertDialogContent>
  </AlertDialog>
</template>
