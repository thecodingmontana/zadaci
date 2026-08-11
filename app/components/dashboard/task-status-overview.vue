<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  counts: Record<string, number>;
}>();

const STATUS_META = [
  { key: "todo", label: "Todo", color: "#3b82f6" },
  { key: "in_progress", label: "In Progress", color: "#f59e0b" },
  { key: "in_review", label: "In Review", color: "#a855f7" },
  { key: "completed", label: "Completed", color: "#22c55e" },
];

const total = computed(() => STATUS_META.reduce((sum, s) => sum + (props.counts[s.key] ?? 0), 0));

const segments = computed(() =>
  STATUS_META.map((s) => ({
    ...s,
    count: props.counts[s.key] ?? 0,
    pct: total.value > 0 ? ((props.counts[s.key] ?? 0) / total.value) * 100 : 0,
  })),
);

const statuses = [
  { key: "todo", label: "To-do" },
  { key: "in_progress", label: "In Progress" },
  { key: "in_review", label: "In Review" },
  { key: "completed", label: "Completed" },
];
</script>

<template>
  <div class="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
    <div class="flex items-center justify-between">
      <h2 class="text-base font-semibold tracking-tight">Task Status Overview</h2>
      <span class="text-sm text-muted-foreground">{{ total }} tasks</span>
    </div>

    <div class="flex h-3 w-full overflow-hidden rounded-full bg-muted">
      <div
        v-for="seg in segments"
        :key="seg.key"
        class="h-full transition-[width] duration-500 ease-out"
        :style="{ width: `${seg.pct}%`, backgroundColor: seg.color }"
      />
    </div>

    <div class="flex flex-wrap gap-x-5 gap-y-2">
      <div v-for="s in statuses" :key="s.key" class="flex items-center gap-2 text-sm">
        <span
          class="size-2.5 rounded-full"
          :style="{ backgroundColor: STATUS_META.find((m) => m.key === s.key)!.color }"
        />
        <span class="text-muted-foreground">{{ s.label }}</span>
        <span class="font-medium tabular-nums">{{ props.counts[s.key] ?? 0 }}</span>
      </div>
    </div>
  </div>
</template>
