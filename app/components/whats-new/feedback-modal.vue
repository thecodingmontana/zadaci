<script setup lang="ts">
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "~/lib/toast";
import { useModalStore } from "~/stores/use-modal-store";

const modalStore = useModalStore();

const isModalOpen = computed(() => {
  return modalStore?.type === "feedback" && modalStore?.isOpen;
});

const onClose = () => {
  modalStore?.onClose();
  modalStore?.setIsOpen(false);
};

const typeOptions = [
  { value: "bug", label: "Bug report", icon: "solar:bug-linear" },
  { value: "feature", label: "Feature request", icon: "solar:sparkles-bold" },
  { value: "feedback", label: "General feedback", icon: "solar:chat-round-line-linear" },
];

const type = ref("feedback");
const message = ref("");
const isSubmitting = ref(false);

async function onSubmit() {
  const trimmed = message.value.trim();
  if (!trimmed) {
    toast.error("Please write a message", { position: "top-center" });
    return;
  }

  isSubmitting.value = true;
  const promise = $fetch("/api/user/feedback", {
    method: "POST",
    body: { type: type.value, message: trimmed },
  });

  toast.promise(promise, {
    loading: "Sending feedback...",
    success: "Thanks for your feedback!",
    error: (err: any) =>
      err?.response?._data?.statusMessage ?? err?.message ?? "Failed to send feedback",
    position: "top-center",
  });

  promise
    .then(() => onClose())
    .catch(() => {})
    .finally(() => {
      isSubmitting.value = false;
      message.value = "";
    });
}
</script>

<template>
  <Dialog :open="isModalOpen" @update:open="onClose">
    <DialogContent class="sm:max-w-md dark:bg-[#1d1d1d]">
      <DialogHeader>
        <div class="flex items-center gap-2">
          <div class="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
            <Icon name="solar:chat-round-line-linear" class="size-5 text-brand" />
          </div>
          <div>
            <DialogTitle class="text-brand dark:text-primary">Share feedback</DialogTitle>
            <DialogDescription class="sr-only"> Send feedback about Zadaci </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <div class="grid gap-2">
          <label class="text-sm font-medium">Type</label>
          <Select v-model="type">
            <SelectTrigger class="w-full cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
                <span class="flex items-center gap-2">
                  <Icon :name="opt.icon" class="size-4" />
                  {{ opt.label }}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="grid gap-2">
          <label class="text-sm font-medium">Message</label>
          <Textarea
            v-model="message"
            rows="4"
            placeholder="Tell us what's on your mind..."
            class="resize-none"
          />
        </div>

        <div class="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            class="cursor-pointer"
            :disabled="isSubmitting"
            @click="onClose"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            class="cursor-pointer bg-brand text-white hover:bg-brand-secondary"
            :disabled="isSubmitting"
          >
            Send
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
