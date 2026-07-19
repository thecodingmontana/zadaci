<script setup lang="ts">
defineProps<{ label: string; align?: "center" | "end" }>();
</script>

<template>
  <div class="my-3 flex items-center" :class="[align === 'end' ? 'justify-end' : 'justify-center']">
    <button
      type="button"
      class="flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs font-medium hover:bg-accent"
    >
      {{ label }}
      <Icon name="lucide:chevron-down" size="12" />
    </button>
  </div>
</template>
