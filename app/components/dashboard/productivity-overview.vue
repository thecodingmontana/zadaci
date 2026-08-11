<script setup lang="ts">
import type { ProductivityDay, StatTrend } from "~/composables/use-dashboard-stats";
import { format } from "date-fns";
import { computed } from "vue";

const props = defineProps<{
  title?: string;
  series: ProductivityDay[];
  month: Date;
  total: number;
  avg: number;
  trend?: StatTrend | null;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}>();

interface ChartPoint {
  day: string;
  completed: number;
}

const chartData = computed<ChartPoint[]>(() =>
  props.series.map((d) => ({
    day: format(new Date(d.day), "MMM d"),
    completed: d.completed,
  })),
);

function xFormatter(tick: number): string {
  return chartData.value[tick]?.day ?? "";
}
function yFormatter(tick: number): string {
  return tick.toString();
}

const CATEGORIES = {
  completed: { name: "Completed", color: "var(--brand)" },
};

// ── Hover callout for the selected day (productivity %, completed, overdue) ──
function dayData(label: string | undefined): ProductivityDay | null {
  if (!label) return null;
  return props.series.find((d) => format(new Date(d.day), "MMM d") === label) ?? null;
}

function trendLabel(trend: StatTrend) {
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
function isPositive(trend: StatTrend) {
  return trend.delta >= 0;
}

const monthLabel = computed(() => format(props.month, "MMMM yyyy"));
const today = new Date();
const canGoPrev = computed(() => {
  const current = new Date(props.month.getFullYear(), props.month.getMonth(), 1);
  const now = new Date(today.getFullYear(), today.getMonth(), 1);
  return current < now;
});
const canGoNext = computed(() => {
  const current = new Date(props.month.getFullYear(), props.month.getMonth(), 1);
  const now = new Date(today.getFullYear(), today.getMonth(), 1);
  return current < now;
});
</script>

<template>
  <div class="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold tracking-tight">{{ title }}</h2>
        <p class="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{{ total }} tasks</span>
          <span class="text-muted-foreground/50">·</span>
          <span>Avg {{ avg }} completed/day</span>
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
            <span class="font-normal opacity-70">from last month</span>
          </span>
        </p>
      </div>

      <div class="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          class="size-8 text-muted-foreground"
          :disabled="!canGoPrev"
          @click="onPrevMonth"
        >
          <Icon name="solar:alt-arrow-left-linear" class="size-4" />
        </Button>
        <span class="min-w-28 text-center text-sm font-medium">{{ monthLabel }}</span>
        <Button
          variant="ghost"
          size="icon"
          class="size-8 text-muted-foreground"
          :disabled="!canGoNext"
          @click="onNextMonth"
        >
          <Icon name="solar:alt-arrow-right-linear" class="size-4" />
        </Button>
      </div>
    </div>

    <div class="relative">
      <BarChart
        :data="chartData"
        :categories="CATEGORIES"
        :y-axis="['completed']"
        :height="280"
        :x-formatter="xFormatter"
        :y-formatter="yFormatter"
        :y-num-ticks="4"
        :group-padding="0.15"
        :bar-padding="0.35"
        :radius="6"
        :hide-legend="true"
        :y-grid-line="false"
        :x-domain-line="true"
        :duration="500"
      >
        <template #tooltip="{ values }">
          <div
            class="pointer-events-none rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-lg"
          >
            <template v-if="dayData(values?.day)">
              <p class="text-xs font-medium text-muted-foreground">
                {{ format(new Date(dayData(values?.day)!.day), "EEEE, MMM d") }}
              </p>
              <div class="mt-1 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p class="text-sm font-semibold tabular-nums">
                    {{ dayData(values?.day)!.productivityPct }}%
                  </p>
                  <p class="text-[11px] text-muted-foreground">Productive</p>
                </div>
                <div>
                  <p class="text-sm font-semibold tabular-nums">
                    {{ dayData(values?.day)!.completed }}
                  </p>
                  <p class="text-[11px] text-muted-foreground">Completed</p>
                </div>
                <div>
                  <p class="text-sm font-semibold tabular-nums">
                    {{ dayData(values?.day)!.overdue }}
                  </p>
                  <p class="text-[11px] text-muted-foreground">Overdue</p>
                </div>
              </div>
            </template>
          </div>
        </template>
      </BarChart>
    </div>
  </div>
</template>
