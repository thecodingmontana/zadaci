<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { Loader2, RotateCw, SendHorizonal } from "@lucide/vue";
import { toast } from "~/lib/toast";
import { cn } from "~/lib/utils";

const props = defineProps<{
  email: string;
  apiUrl: string;
  setIsResendingCode: (payload: boolean) => void;
  isResendCode: boolean;
}>();

const timeElapsed = ref(30);

let timer: ReturnType<typeof setInterval> | null = null;

const isStopTimer = ref(false);

function startTimer() {
  isStopTimer.value = true;
  if (timer) {
    isStopTimer.value = false;
    return;
  }
  timer = setInterval(() => {
    if (timeElapsed.value > 0) {
      timeElapsed.value -= 1;
    } else {
      clearInterval(timer!);
      timer = null;
      isStopTimer.value = false;
      timeElapsed.value = 30;
    }
  }, 1000);
}

async function onResendCode() {
  try {
    props.setIsResendingCode(true);

    const res: { message: string } = await $fetch(props.apiUrl, {
      method: "POST",
      body: {
        email: props.email,
      },
    });

    toast.success(res.message ?? "Code resent successfully", {
      desc: "Check your inbox for the new code",
      position: "top-center",
      action: {
        label: "Dismiss",
        icon: SendHorizonal,
      },
    });
    startTimer();
  } catch (error: any) {
    const errorMessage = error?.response ? error.response._data?.statusMessage : error?.message;

    toast.error(errorMessage ?? "Couldn't resend the code, please try again.", {
      desc: "Check your connection and try again",
      position: "top-center",
      action: {
        label: "Retry",
        icon: RotateCw,
        onClick: onResendCode,
      },
    });
  } finally {
    props.setIsResendingCode(false);
  }
}
</script>

<template>
  <button
    :disabled="props.isResendCode || (timeElapsed > 0 && isStopTimer)"
    type="button"
    :class="
      cn(
        'inline-flex cursor-pointer items-center gap-1 font-medium',
        isResendCode || (timeElapsed > 0 && isStopTimer)
          ? 'text-xs text-muted-foreground'
          : 'text-sm text-brand hover:text-brand-secondary',
      )
    "
    @click="onResendCode"
  >
    <Loader2 v-if="isResendCode" class="size-3.5 animate-spin" />
    <span v-if="isResendCode">Resending</span>
    <span v-else-if="timeElapsed > 0 && isStopTimer">Resending in {{ timeElapsed }}s</span>
    <template v-else>
      <RotateCw class="size-3.5" />
      <span>Resend</span>
    </template>
  </button>
</template>
