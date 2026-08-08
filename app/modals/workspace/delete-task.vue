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
  return modalStore?.type === "deleteTask" && modalStore?.isOpen;
});

const taskId = computed(() => modalStore?.data?.taskId);
const taskTitle = computed(() => modalStore?.data?.taskTitle);
const projectId = computed(() => modalStore?.data?.projectId);
const workspaceId = computed(() => modalStore?.data?.workspaceId);

const isDeleting = ref(false);

function onClose() {
  modalStore?.setIsOpen(false);
  modalStore?.onClose();
}

async function onDelete() {
  if (!taskId.value || !projectId.value || !workspaceId.value) return;
  isDeleting.value = true;

  const promise = $fetch(
    `/api/workspace/${workspaceId.value}/project/${projectId.value}/tasks/${taskId.value}/delete`,
    {
      method: "DELETE",
    },
  );

  toast.promise(promise, {
    loading: "Moving task to trash...",
    success: `${taskTitle.value ?? "Task"} moved to trash`,
    error: (err: any) =>
      err?.response?._data?.statusMessage ?? err?.message ?? "Couldn't delete task",
    errorDesc: "Try again later",
    position: "top-center",
  });

  promise
    .then(async () => {
      const db = await useRxDbSafe();
      if (db) {
        const now = new Date().toISOString();
        const doc = await db.tasks.findOne(taskId.value!).exec();
        if (doc) {
          await doc.patch({ deleted_at: now, updated_at: now });
        }
      }
      onClose();
      if (workspaceId.value) {
        navigateTo(`/workspace/${workspaceId.value}/tasks/all`);
      }
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
            <AlertDialogTitle class="text-brand"> Delete {{ taskTitle }} </AlertDialogTitle>
            <AlertDialogDescription>
              This will move the task <strong>{{ taskTitle }}</strong> and all its subtasks to the
              trash. You can restore them later from the trash.
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
          Move to Trash
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
