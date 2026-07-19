<script setup lang="ts">
defineProps<{
  name: string;
  type: "discussion" | "conversation";
}>();
</script>

<template>
  <div class="mb-4 space-y-2 px-4">
    <div
      class="flex h-[75px] w-[75px] items-center justify-center rounded-full bg-zinc-500 dark:bg-zinc-700"
    >
      <Icon name="lucide:hash" size="48" class="text-white" />
    </div>

    <p class="text-xl font-bold md:text-3xl">Welcome to #{{ name }}</p>

    <p class="text-sm text-zinc-600 dark:text-zinc-400">
      This is the start of the #{{ name }} discussion — send the first message.
    </p>
  </div>
</template>
