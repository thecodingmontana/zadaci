<script setup lang="ts">
import type { TaskDocType } from "~/plugins/rxdb.client";
import { isWithinInterval, parseISO, startOfWeek, subWeeks } from "date-fns";
import { computed, ref } from "vue";
import { Skeleton } from "~/components/ui/skeleton";

const props = defineProps<{
  tasks: TaskDocType[];
  loading: boolean;
}>();

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface ProductivityDataItem {
  day: string;
  completed: number;
  inReview: number;
  abandoned: number;
}

const selectedRange = ref<"this" | "last">("this");

const weekInterval = computed(() => {
  const base = selectedRange.value === "this" ? new Date() : subWeeks(new Date(), 1);
  const start = startOfWeek(base, { weekStartsOn: 1 });
  return {
    start,
    end: new Date(start.getTime() + 6 * 86400000),
  };
});

const topLevelTasks = computed(() => props.tasks.filter((t) => !t.parent_task_id && !t.deleted_at));

const productivityData = computed<ProductivityDataItem[]>(() => {
  const { start, end } = weekInterval.value;

  const counts: Record<string, ProductivityDataItem> = {};
  for (const day of weekDays) {
    counts[day] = { day, completed: 0, inReview: 0, abandoned: 0 };
  }

  for (const t of topLevelTasks.value) {
    if (!t.updated_at) continue;
    const d = parseISO(t.updated_at);
    if (!isWithinInterval(d, { start, end })) continue;
    const day = weekDays[d.getDay() === 0 ? 6 : d.getDay() - 1];
    if (t.status === "completed") counts[day].completed += 1;
    else if (t.status === "in_review") counts[day].inReview += 1;
    else if (t.status === "abandoned") counts[day].abandoned += 1;
  }

  return weekDays.map((day) => counts[day]);
});

// True once there's at least one bar to actually draw — avoids rendering
// a 300px chart canvas that's visually empty except for axis/legend marks.
const hasActivity = computed(() =>
  productivityData.value.some((d) => d.completed > 0 || d.inReview > 0 || d.abandoned > 0),
);

const ProductivityCategories = {
  completed: { name: "Completed", color: "#22c55e" },
  inReview: { name: "In Review", color: "#eab308" },
  abandoned: { name: "Abandoned", color: "#ef4444" },
};

const xFormatter = (i: number): string => productivityData.value[i]?.day ?? "";
const yFormatter = (tick: number) => tick.toString();
</script>

<template>
  <div class="grid gap-5 rounded-md border p-5">
    <div class="flex flex-col justify-between gap-2 xl:flex-row">
      <h2 class="text-lg font-medium">Weekly Tasks Productivity Overview</h2>
      <div class="flex items-center gap-x-2">
        <div class="inline-flex h-9 w-full rounded-lg bg-input/50 p-0.5 xl:w-auto">
          <RadioGroup
            v-model="selectedRange"
            class="group relative inline-grid w-full grid-cols-[1fr_1fr] items-center gap-0 text-sm font-medium xl:w-auto"
          >
            <RadioGroupItem id="range-last" value="last" class="sr-only" />
            <RadioGroupItem id="range-this" value="this" class="sr-only" />
            <label
              for="range-last"
              class="relative z-10 inline-flex h-full min-w-8 cursor-pointer items-center justify-center px-4 whitespace-nowrap"
              :class="
                selectedRange === 'last'
                  ? 'rounded-md bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              "
            >
              Last week
            </label>
            <label
              for="range-this"
              class="relative z-10 inline-flex h-full min-w-8 cursor-pointer items-center justify-center px-4 whitespace-nowrap"
              :class="
                selectedRange === 'this'
                  ? 'rounded-md bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              "
            >
              This week
            </label>
          </RadioGroup>
        </div>
      </div>
    </div>

    <div class="w-full overflow-hidden">
      <Skeleton v-if="props.loading" class="h-80 w-full rounded-md" />
      <div
        v-else-if="!hasActivity"
        class="flex h-80 w-full flex-col items-center justify-center gap-2 text-center"
      >
        <Icon name="solar:chart-2-outline" class="size-8 text-muted-foreground" />
        <p class="text-sm text-muted-foreground">
          No task activity {{ selectedRange === "this" ? "this" : "last" }} week yet.
        </p>
      </div>
      <BarChart
        v-else
        :data="productivityData"
        :height="300"
        :categories="ProductivityCategories"
        :y-axis="['completed', 'inReview', 'abandoned']"
        :x-num-ticks="6"
        :x-formatter="xFormatter"
        :y-formatter="yFormatter"
        :group-padding="0"
        :bar-padding="0.2"
        :radius="4"
        :legend-position="LegendPosition.Top"
        :hide-legend="false"
        :y-grid-line="false"
      />
    </div>
  </div>
</template>
