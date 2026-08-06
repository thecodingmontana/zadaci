<script setup lang="ts">
import type { TaskDocType } from "~/plugins/rxdb.client";
import { useProjectTasks } from "~/composables/use-project-tasks";

const props = defineProps<{
  workspaceId: string;
  projectId: string;
  parentTaskId?: string | null;
}>();

const { topLevelTasks, subtaskCounts } = useProjectTasks(() => ({
  projectId: props.projectId,
  parentTaskId: props.parentTaskId,
}));

const statusColors: Record<TaskDocType["status"], string> = {
  idea: "bg-gray-400",
  todo: "bg-blue-500",
  in_progress: "bg-amber-500",
  in_review: "bg-purple-500",
  completed: "bg-green-500",
  abandoned: "bg-red-500",
};

const statusLabel: Record<TaskDocType["status"], string> = {
  idea: "Idea",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  completed: "Completed",
  abandoned: "Abandoned",
};

const DAY_MS = 86_400_000;

const scheduledTasks = computed(() =>
  topLevelTasks.value
    .filter((t) => t.due_date && !Number.isNaN(new Date(t.due_date).getTime()))
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()),
);

const unscheduledTasks = computed(() =>
  topLevelTasks.value.filter((t) => !t.due_date || Number.isNaN(new Date(t.due_date).getTime())),
);

const today = computed(() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
});

const range = computed(() => {
  if (scheduledTasks.value.length === 0) {
    return { start: today.value, end: new Date(today.value.getTime() + 30 * DAY_MS) };
  }
  const first = scheduledTasks.value[0]?.due_date
    ? new Date(scheduledTasks.value[0].due_date)
    : today.value;
  const last = scheduledTasks.value[scheduledTasks.value.length - 1]?.due_date
    ? new Date(scheduledTasks.value[scheduledTasks.value.length - 1].due_date!)
    : new Date(today.value.getTime() + 30 * DAY_MS);

  const start = new Date(Math.min(first.getTime(), today.value.getTime()));
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 7);

  const end = new Date(Math.max(last.getTime(), today.value.getTime()));
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 7);

  return { start, end };
});

const totalDays = computed(() => {
  const diff = Math.max(
    1,
    Math.round((range.value.end.getTime() - range.value.start.getTime()) / DAY_MS),
  );
  return diff;
});

const dayWidth = 32;

function dateToOffset(date: Date) {
  return ((date.getTime() - range.value.start.getTime()) / DAY_MS) * dayWidth;
}

function dueOffset(task: TaskDocType) {
  if (!task.due_date) return 0;
  const d = new Date(task.due_date);
  d.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(dateToOffset(d)));
}

function barWidth(task: TaskDocType) {
  const created = task.created_at ? new Date(task.created_at) : today.value;
  created.setHours(0, 0, 0, 0);
  const due = task.due_date ? new Date(task.due_date) : today.value;
  due.setHours(0, 0, 0, 0);
  const days = Math.max(1, Math.round((due.getTime() - created.getTime()) / DAY_MS));
  return days * dayWidth;
}

function formatBarDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const axisDays = computed(() => {
  const days: { date: Date; label: string; isToday: boolean }[] = [];
  for (let i = 0; i < totalDays.value; i++) {
    const d = new Date(range.value.start.getTime() + i * DAY_MS);
    days.push({
      date: d,
      label: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      isToday: d.getTime() === today.value.getTime(),
    });
  }
  return days;
});

function openTask(task: TaskDocType) {
  navigateTo(`/workspace/${props.workspaceId}/tasks/${task.id}`);
}

const isOverdue = (task: TaskDocType) => {
  if (!task.due_date) return false;
  if (task.status === "completed" || task.status === "abandoned") return false;
  const d = new Date(task.due_date);
  d.setHours(0, 0, 0, 0);
  return d < today.value;
};
</script>

<template>
  <div class="rounded-lg border bg-background dark:bg-[#1d1d1d]">
    <div class="flex items-center justify-between border-b px-4 py-3">
      <div class="flex items-center gap-2 text-sm font-medium">
        <Icon name="solar:chart-square-linear" class="size-4 text-muted-foreground" />
        Timeline
      </div>
      <div class="flex items-center gap-3 text-xs text-muted-foreground">
        <span v-for="(color, key) in statusColors" :key="key" class="flex items-center gap-1">
          <span class="size-2 rounded-full" :class="color" />
          {{ statusLabel[key as TaskDocType["status"]] }}
        </span>
      </div>
    </div>

    <div class="overflow-x-auto">
      <div class="min-w-max p-4">
        <!-- Header axis -->
        <div class="sticky top-0 flex" style="min-width: max-content">
          <div class="w-64 shrink-0" />
          <div
            v-for="(day, i) in axisDays"
            :key="i"
            class="shrink-0 border-l text-[10px] text-muted-foreground"
            :style="{ width: `${dayWidth}px`, height: '2rem' }"
            :class="day.isToday && 'font-semibold text-primary'"
          >
            <span class="ps-1">{{ day.label }}</span>
          </div>
        </div>

        <!-- Scheduled task rows -->
        <div v-if="scheduledTasks.length > 0" class="space-y-2">
          <div v-for="task in scheduledTasks" :key="task.id" class="flex items-center">
            <div class="flex w-64 shrink-0 items-center gap-2 pe-3">
              <span class="size-2 shrink-0 rounded-full" :class="statusColors[task.status]" />
              <button
                class="truncate text-left text-sm font-medium hover:underline"
                @click="openTask(task)"
              >
                {{ task.name }}
              </button>
              <span
                v-if="subtaskCounts[task.id]?.total"
                class="ml-auto shrink-0 text-xs text-muted-foreground"
              >
                {{ subtaskCounts[task.id].completed }}/{{ subtaskCounts[task.id].total }}
              </span>
            </div>
            <div class="relative h-9 flex-1">
              <div
                class="absolute inset-y-0 border-l border-dashed"
                :style="{ left: `${dueOffset(task)}px` }"
              />
              <button
                class="absolute top-1/2 flex h-6 -translate-y-1/2 cursor-pointer items-center gap-1 rounded-md px-2 text-[11px] font-medium text-white shadow-sm transition-opacity hover:opacity-80"
                :class="[statusColors[task.status], isOverdue(task) && 'ring-2 ring-rose-500/70']"
                :style="{
                  left: `${dueOffset(task) - (barWidth(task) - dayWidth) / 2}px`,
                  width: `${Math.max(dayWidth, barWidth(task))}px`,
                  minWidth: `${dayWidth}px`,
                }"
                :title="`${task.name} — due ${formatBarDate(task.due_date!)}`"
                @click="openTask(task)"
              >
                <span class="truncate">{{ formatBarDate(task.due_date!) }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Unscheduled tasks -->
        <div v-if="unscheduledTasks.length > 0" class="mt-6 border-t pt-4">
          <p class="mb-2 text-xs font-medium text-muted-foreground">
            No due date ({{ unscheduledTasks.length }})
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="task in unscheduledTasks"
              :key="task.id"
              class="flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
              @click="openTask(task)"
            >
              <span class="size-1.5 rounded-full" :class="statusColors[task.status]" />
              <span class="font-medium">{{ task.name }}</span>
              <span v-if="subtaskCounts[task.id]?.total" class="text-muted-foreground">
                {{ subtaskCounts[task.id].completed }}/{{ subtaskCounts[task.id].total }}
              </span>
            </button>
          </div>
        </div>

        <div
          v-if="topLevelTasks.length === 0"
          class="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground"
        >
          <Icon name="solar:calendar-linear" class="size-8" />
          No tasks yet. Add one to see it here.
        </div>
      </div>
    </div>
  </div>
</template>
