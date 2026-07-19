<script setup lang="ts">
import { Loader } from "@lucide/vue";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { toast } from "~/lib/toast";
import { useModalStore } from "~/stores/use-modal-store";

const { clear: clearSession } = useUserSession();
const modalStore = useModalStore();

const isModalOpen = computed(() => {
  return modalStore?.type === "signout" && modalStore?.isOpen;
});

const isSigninOut = ref(false);

function onSignOut() {
  isSigninOut.value = true;
  onClose();
  const promise = (async () => {
    console.log("[signout] Signing out — setting nuclear clear flag + clearing session");
    localStorage.setItem("zadaci_clear_needed", "true");
    await clearSession();
    console.log("[signout] Session cleared, now clearing RxDB");
    await useClearRxDb();
    console.log("[signout] RxDB cleared, navigating to signin");
    return navigateTo("/auth/signin");
  })();
  toast.promise(promise, {
    loading: "Signing out...",
    success: "Signed out successfully",
    error: (err: any) =>
      err?.response?._data?.message ?? err?.message ?? "Couldn't sign you out, please try again.",
    desc: "See you again soon",
    errorDesc: "Something went wrong on our end",
    position: "top-center",
  });
  promise
    .catch(() => {})
    .finally(() => {
      isSigninOut.value = false;
    });
}

function onClose() {
  modalStore?.setIsOpen(false);
  modalStore?.onClose();
}
</script>

<template>
  <Dialog :open="isSigninOut || isModalOpen" @update:open="onClose">
    <DialogContent class="dark:bg-[#1d1d1d]">
      <DialogHeader class="items-center">
        <DialogDescription class="text-destructive">
          <Icon name="twemoji:sad-but-relieved-face" class="mx-auto" size="80" />
        </DialogDescription>
        <DialogTitle class="text-center text-2xl">
          Oh no! You're leaving... <br />
          Are you sure?
        </DialogTitle>
      </DialogHeader>
      <div class="space-y-2">
        <Button
          :disabled="isSigninOut"
          class="w-full cursor-pointer"
          variant="destructive"
          @click="onSignOut"
        >
          <Loader v-if="isSigninOut" class="h-auto w-5 animate-spin" />
          Yes, sign me out!
        </Button>
        <Button
          :disabled="isSigninOut"
          class="w-full cursor-pointer"
          variant="outline"
          @click="onClose"
        >
          Naah! Just kidding.
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
