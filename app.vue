<script setup lang="ts">
import { useNetwork } from "@vueuse/core";

const network = reactive(useNetwork());
const wasDismissed = ref(false);

const isOffline = computed(() => !network.isOnline && !wasDismissed.value);
</script>

<template>
  <div>
    <div
      v-if="isOffline"
      class="relative z-50 flex items-center justify-center gap-2 bg-[#fafafa] px-4 py-2 text-center text-xs font-medium text-black/70 dark:border-white/10 dark:bg-[#111110] dark:text-white/70"
    >
      <Icon name="hugeicons:wifi-off-01" class="shrink-0 text-amber-500" size="16" />
      <span> You're offline — changes will sync automatically when connection returns. </span>
      <button
        type="button"
        aria-label="Dismiss banner"
        class="ml-1 grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-black/40 transition hover:bg-black/5 hover:text-black/70 dark:text-white/40 dark:hover:bg-white/5 dark:hover:text-white/70"
        @click="wasDismissed = true"
      >
        <Icon name="hugeicons:cancel-01" class="size-3.5" />
      </button>
    </div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
