<script setup lang="ts">
import type { TaskDocType } from "~/plugins/rxdb.client";
import { endOfWeek, isThisWeek, startOfWeek, subWeeks } from "date-fns";
import { computed } from "vue";

const props = defineProps<{
  tasks: TaskDocType[];
}>();

const topLevelTasks = computed(() => props.tasks.filter((t) => !t.parent_task_id && !t.deleted_at));

const total = computed(() => topLevelTasks.value.length);
const completed = computed(
  () => topLevelTasks.value.filter((t) => t.status === "completed").length,
);
const inProgress = computed(
  () => topLevelTasks.value.filter((t) => t.status === "in_progress").length,
);

function isLastWeek(date: Date) {
  const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
  return date >= lastWeekStart && date <= lastWeekEnd;
}

const weeklyDifference = computed<number | null>(() => {
  const completedThisWeek = topLevelTasks.value.filter(
    (t) => t.status === "completed" && isThisWeek(new Date(t.updated_at)),
  ).length;
  const completedLastWeek = topLevelTasks.value.filter(
    (t) => t.status === "completed" && isLastWeek(new Date(t.updated_at)),
  ).length;

  if (completedLastWeek === 0 && completedThisWeek > 0) return 100;
  if (completedLastWeek === 0) return null;
  return Math.round(((completedThisWeek - completedLastWeek) / completedLastWeek) * 100);
});

const donutData = computed(() => {
  if (total.value === 0) return [0, 0];
  return [
    Math.round((completed.value / total.value) * 100),
    Math.round((inProgress.value / total.value) * 100),
  ];
});

const labels = computed(() => [
  { name: "Completed", color: "#22c55e" },
  { name: "In Progress", color: "#3b82f6" },
]);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <h2 class="text-base font-semibold tracking-tight">All Tasks Stats</h2>
      <Icon name="solar:refresh-outline" class="size-4 text-muted-foreground" />
    </div>

    <div class="flex h-[275px] w-full items-center justify-center overflow-hidden">
      <DonutChart
        :data="donutData"
        :height="275"
        :labels="labels"
        :hide-legend="true"
        :radius="0"
        type="half"
      />
    </div>

    <div class="grid grid-cols-2">
      <div class="flex flex-col items-center">
        <div class="flex items-center gap-x-2">
          <div class="size-1.5 rounded-full bg-green-500" />
          <p class="text-sm text-muted-foreground">Completed</p>
        </div>
        <p class="text-2xl font-medium">{{ completed }}</p>
      </div>
      <div class="flex flex-col items-center">
        <div class="flex items-center gap-x-2">
          <div class="size-1.5 rounded-full bg-blue-500" />
          <p class="text-sm text-muted-foreground">In Progress</p>
        </div>
        <p class="text-2xl font-medium">{{ inProgress }}</p>
      </div>
    </div>

    <p class="text-center text-sm text-muted-foreground">
      <template v-if="weeklyDifference !== null">
        You completed
        <strong
          :class="{
            'text-emerald-500': weeklyDifference > 0,
            'text-rose-500': weeklyDifference < 0,
            'text-muted-foreground': weeklyDifference === 0,
          }"
        >
          {{ Math.abs(weeklyDifference) }}%
          {{ weeklyDifference > 0 ? "more" : weeklyDifference < 0 ? "less" : "same" }}
        </strong>
        of tasks this week than last week.
      </template>
      <template v-else> No comparison data available. </template>
    </p>
  </div>
</template>
