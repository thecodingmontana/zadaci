<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  counts: Record<string, number>;
}>();

const STATUSES = [
  {
    key: "todo",
    label: "To-do",
    icon: "solar:clipboard-outline",
    bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    key: "in_progress",
    label: "In Progress",
    icon: "solar:alarm-outline",
    bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    key: "in_review",
    label: "In Review",
    icon: "solar:minimalistic-magnifer-bug-outline",
    bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
  {
    key: "completed",
    label: "Completed",
    icon: "solar:check-circle-outline",
    bg: "bg-green-500/10 text-green-600 dark:text-green-400",
  },
];

const total = computed(() => Object.values(props.counts).reduce((a, b) => a + b, 0));

function pct(key: string) {
  if (!total.value) return 0;
  return Math.round(((props.counts[key] ?? 0) / total.value) * 100);
}
</script>

<template>
  <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
    <div
      v-for="s in STATUSES"
      :key="s.key"
      class="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm"
    >
      <div class="flex size-10 items-center justify-center rounded-lg" :class="s.bg">
        <Icon :name="s.icon" class="size-5" />
      </div>
      <div class="min-w-0">
        <p class="text-lg leading-tight font-semibold tabular-nums">
          {{ props.counts[s.key] ?? 0 }}
        </p>
        <p class="truncate text-xs text-muted-foreground">{{ s.label }} · {{ pct(s.key) }}%</p>
      </div>
    </div>
  </div>
</template>
