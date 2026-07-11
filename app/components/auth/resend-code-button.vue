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

const RESEND_COOLDOWN_S = 30;
const timeElapsed = ref(RESEND_COOLDOWN_S);
const isStopTimer = ref(false);

let timer: ReturnType<typeof setInterval> | null = null;

function clearTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function startTimer() {
  // Timer's already running — do nothing, don't touch isStopTimer or the
  // UI will show "Resend" as clickable while the interval keeps ticking.
  if (timer) return;

  isStopTimer.value = true;
  timeElapsed.value = RESEND_COOLDOWN_S;

  timer = setInterval(() => {
    if (timeElapsed.value > 0) {
      timeElapsed.value -= 1;
    } else {
      clearTimer();
      isStopTimer.value = false;
      timeElapsed.value = RESEND_COOLDOWN_S;
    }
  }, 1000);
}

// A code was already sent right before this component appears — start the
// cooldown immediately instead of leaving "Resend" clickable on mount.
onMounted(startTimer);
onUnmounted(clearTimer);

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
