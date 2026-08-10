<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "~/lib/utils";

const props = defineProps<{
  title: string;
  value: number | string;
  icon: string;
  trend?: { delta: number; percent: number | null } | null;
  caption?: string;
  iconClass?: HTMLAttributes["class"];
  class?: HTMLAttributes["class"];
}>();

function trendLabel(trend: { delta: number; percent: number | null }) {
  if (trend.percent !== null) {
    const sign = trend.delta >= 0 ? "+" : "";
    return `${sign}${trend.percent}%`;
  }
  if (trend.delta !== 0) {
    const sign = trend.delta >= 0 ? "+" : "";
    return `${sign}${trend.delta}`;
  }
  return null;
}

function isPositive(trend: { delta: number; percent: number | null }) {
  return trend.delta >= 0;
}
</script>

<template>
  <div
    data-slot="stat-card"
    :class="
      cn(
        'relative flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm transition-colors hover:bg-accent/40',
        props.class,
      )
    "
  >
    <div class="flex items-start justify-between">
      <div
        class="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand dark:bg-brand/15"
      >
        <Icon :name="icon" class="size-4.5" :class="iconClass" />
      </div>
      <Button variant="ghost" size="icon" class="size-7 text-muted-foreground">
        <Icon name="solar:menu-dots-bold" class="size-4" />
      </Button>
    </div>

    <div class="flex flex-col gap-0.5">
      <div class="flex items-baseline gap-2">
        <span class="text-3xl font-semibold tracking-tight tabular-nums">{{ value }}</span>
        <span
          v-if="trend && trendLabel(trend)"
          class="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium"
          :class="
            isPositive(trend)
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-red-500/10 text-red-600 dark:text-red-400'
          "
        >
          <Icon
            :name="isPositive(trend) ? 'solar:arrow-up-linear' : 'solar:arrow-down-linear'"
            class="size-3"
          />
          {{ trendLabel(trend) }}
        </span>
      </div>
      <span class="text-sm text-muted-foreground">{{ title }}</span>
    </div>

    <p v-if="caption" class="text-xs text-muted-foreground/80">{{ caption }}</p>
  </div>
</template>
