<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { motion, useReducedMotion } from "motion-v";
import { computed, onUnmounted, ref, watch } from "vue";
import ActionTooltip from "~/components/workspace/shared/action-tooltip.vue";
import { cn } from "~/lib/utils";

export interface ContributionDataPoint {
  date: string;
  count: number;
}

const props = withDefaults(
  defineProps<{
    data?: ContributionDataPoint[];
    weeks?: number;
    accent?: string;
    title?: string;
    class?: HTMLAttributes["class"];
  }>(),
  {
    weeks: 53,
    accent: "#3ecf8e",
    title: "contributions in the last year",
  },
);

const reduce = useReducedMotion();

const WEEKDAYS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const LEVEL_MIX = [0, 28, 50, 74, 100];
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

function levelFor(count: number): number {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

function seeded(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function generate(weeks: number): ContributionDataPoint[] {
  const days: ContributionDataPoint[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() - end.getDay() + 6);
  const total = weeks * 7;
  for (let i = total - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const r = seeded(d.getTime() / 8.64e7);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    let count = 0;
    if (r > 0.55) count = Math.round((r - 0.55) * (weekend ? 12 : 26));
    days.push({ date: d.toISOString().slice(0, 10), count });
  }
  return days;
}

function formatDate(iso: string): string {
  const [y, m, day] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${day}, ${y}`;
}

// Oldest → newest. Only when NO data prop is supplied at all do we fall back
// to generated sample data — an intentionally empty array renders as zeros.
const days = computed<ContributionDataPoint[]>(() => {
  if (props.data !== undefined) {
    return [...props.data].sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  return generate(props.weeks);
});

const total = computed(() => days.value.reduce((sum, d) => sum + d.count, 0));

// ── Count-up total (rAF, 900ms, cubic ease-out) ──
const shownTotal = ref(0);
const raf = shallowRef<number | null>(null);
let startTs = 0;

function tick(ts: number) {
  if (!startTs) startTs = ts;
  const p = Math.min((ts - startTs) / 900, 1);
  const eased = 1 - (1 - p) ** 3;
  shownTotal.value = Math.round(total.value * eased);
  if (p < 1) raf.value = requestAnimationFrame(tick);
}

function cancelRaf() {
  if (raf.value !== null) cancelAnimationFrame(raf.value);
  raf.value = null;
  startTs = 0;
}

watch(
  total,
  (val) => {
    if (!import.meta.client) {
      shownTotal.value = val;
      return;
    }
    cancelRaf();
    if (reduce.value) {
      shownTotal.value = val;
      return;
    }
    raf.value = requestAnimationFrame(tick);
  },
  { immediate: true },
);

onUnmounted(() => {
  if (import.meta.client) cancelRaf();
});

// ── Columns (weeks of 7 days) ──
const columns = computed(() => {
  const out: ContributionDataPoint[][] = [];
  for (let i = 0; i < days.value.length; i += 7) out.push(days.value.slice(i, i + 7));
  return out;
});

// Month labels positioned at the first column whose starter day falls on days 1–7.
const monthLabels = computed(() => {
  const labels: { col: number; label: string }[] = [];
  let last = -1;
  columns.value.forEach((week, col) => {
    const starter = week.find((d) => {
      const dom = Number(d.date.slice(8, 10));
      return dom >= 1 && dom <= 7;
    });
    if (!starter) return;
    const month = Number(starter.date.slice(5, 7)) - 1;
    if (month !== last) {
      labels.push({ col, label: MONTHS[month] });
      last = month;
    }
  });
  return labels;
});

function cellLabel(day: ContributionDataPoint): string {
  return `${day.count} ${day.count === 1 ? "contribution" : "contributions"} on ${formatDate(day.date)}`;
}
</script>

<template>
  <div
    :style="{ '--contribution-grid-accent': props.accent } as any"
    :class="
      cn(
        'inline-block rounded-[14px] p-2',
        'bg-white text-neutral-900 dark:bg-[#1e1e1b] dark:text-white',
        'shadow-[0_0_0_1px_rgba(27,27,25,0.05),0_1px_2px_0_rgba(27,27,25,0.05)]',
        'dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05),inset_0_1px_0_0_rgba(255,255,255,0.05)]',
        props.class,
      )
    "
  >
    <div class="flex items-baseline justify-between gap-4 px-1.5 pt-1 pb-2">
      <h2 class="text-[13px] font-medium tracking-[-0.01em]">
        <span class="text-neutral-900 tabular-nums dark:text-white">{{
          shownTotal.toLocaleString()
        }}</span>
        <span class="text-neutral-500 dark:text-[#929292]"> {{ props.title }}</span>
      </h2>
    </div>

    <div
      class="relative rounded-[11px] bg-black/[0.03] p-2.5 shadow-[inset_0_1px_2px_0_rgba(27,27,25,0.05)] dark:bg-black/20 dark:shadow-[inset_0_1px_3px_0_rgba(0,0,0,0.5)]"
    >
      <div class="scrollbar-hide overflow-x-auto py-1">
        <div class="flex gap-2">
          <div class="grid shrink-0 grid-rows-[repeat(7,11px)] gap-[3px] pt-[18px]">
            <span
              v-for="(d, i) in WEEKDAYS"
              :key="i"
              class="h-[11px] text-right text-[9px] leading-[11px] text-neutral-400 dark:text-[#8b8b8b]"
            >
              {{ d }}
            </span>
          </div>

          <div class="relative">
            <div class="relative mb-1 h-[12px]">
              <span
                v-for="m in monthLabels"
                :key="`${m.col}-${m.label}`"
                class="absolute top-0 text-[9px] leading-[12px] text-neutral-400 dark:text-[#8b8b8b]"
                :style="{ left: `${m.col * 14}px` }"
              >
                {{ m.label }}
              </span>
            </div>

            <div class="flex gap-[3px]">
              <div
                v-for="(week, col) in columns"
                :key="col"
                class="grid grid-rows-[repeat(7,11px)] gap-[3px]"
              >
                <ActionTooltip
                  v-for="(day, row) in week"
                  :key="day.date"
                  :label="cellLabel(day)"
                  side="top"
                >
                  <motion.div
                    role="img"
                    :aria-label="cellLabel(day)"
                    :initial="reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }"
                    :animate="{ opacity: 1, scale: 1 }"
                    :transition="{
                      duration: 0.32,
                      ease: EASE_OUT,
                      delay: reduce ? 0 : Math.min((col + row) * 0.008, 0.6),
                    }"
                    :while-hover="reduce ? undefined : { scale: 1.18 }"
                    :while-tap="reduce ? undefined : { scale: 0.9 }"
                    :class="
                      cn(
                        'relative z-0 size-[11px] rounded-[2px] transition-shadow duration-150 ease-out hover:z-10',
                        levelFor(day.count) === 0
                          ? 'bg-black/[0.05] hover:shadow-[0_0_0_1.5px_var(--contribution-grid-accent)] dark:bg-white/[0.04]'
                          : 'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_0_0_1.5px_var(--contribution-grid-accent)]',
                      )
                    "
                    :style="
                      levelFor(day.count) > 0
                        ? {
                            backgroundColor: `color-mix(in srgb, var(--contribution-grid-accent) ${LEVEL_MIX[levelFor(day.count)]}%, transparent)`,
                          }
                        : undefined
                    "
                  />
                </ActionTooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between gap-4 px-1.5 pt-2 pb-1">
      <span class="text-[11px] text-neutral-400 dark:text-[#8b8b8b]">
        {{ columns.length }} weeks of activity
      </span>
      <div class="flex items-center gap-1.5">
        <span class="text-[11px] text-neutral-400 dark:text-[#8b8b8b]">Less</span>
        <motion.span
          v-for="level in 5"
          :key="level"
          :initial="reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }"
          :animate="{ opacity: 1, scale: 1 }"
          :transition="{ duration: 0.3, ease: EASE_OUT, delay: reduce ? 0 : 0.5 + level * 0.05 }"
          :while-hover="reduce ? undefined : { scale: 1.25 }"
          :class="
            cn(
              'size-[11px] rounded-[2px]',
              level === 0 && 'bg-black/[0.05] dark:bg-white/[0.04]',
              level > 0 && 'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]',
            )
          "
          :style="
            level > 0
              ? {
                  backgroundColor: `color-mix(in srgb, var(--contribution-grid-accent) ${LEVEL_MIX[level]}%, transparent)`,
                }
              : undefined
          "
        />
        <span class="text-[11px] text-neutral-400 dark:text-[#8b8b8b]">More</span>
      </div>
    </div>
  </div>
</template>
