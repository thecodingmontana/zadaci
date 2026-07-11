<script lang="ts" setup>
const isVisible = ref(true);

function dismiss() {
  isVisible.value = false;
}
</script>

<template>
  <div
    v-if="isVisible"
    class="relative z-50 flex items-center justify-center gap-2 border-b border-black/10 bg-[#fafafa] px-4 py-2 text-center text-xs font-medium text-black/70 dark:border-white/10 dark:bg-[#111110] dark:text-white/70"
  >
    <Icon name="lucide:construction" class="shrink-0 text-orange-500" size="16" />
    <span>
      We're actively rebuilding Zadaci — some things may look unfinished or change without notice.
    </span>
    <button
      type="button"
      aria-label="Dismiss banner"
      class="ml-1 grid size-5 cursor-pointer shrink-0 place-items-center rounded-full text-black/40 transition hover:bg-black/5 hover:text-black/70 dark:text-white/40 dark:hover:bg-white/5 dark:hover:text-white/70"
      @click="dismiss"
    >
      <Icon name="lucide:x" class="size-3.5" />
    </button>
  </div>
</template>