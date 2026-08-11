<script setup lang="ts">
import type { TaskDocType } from "~/plugins/rxdb.client";
import { addDays, format, startOfWeek } from "date-fns";
import { computed } from "vue";

const props = defineProps<{
  workspaceId: string;
  tasks: TaskDocType[];
}>();

const now = new Date();
const weekStart = startOfWeek(now, { weekStartsOn: 1 });

const weekDays = computed(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)));

const tasksByDate = computed(() => {
  const map = new Map<string, TaskDocType[]>();
  for (const t of props.tasks) {
    if (!t.due_date || t.parent_task_id) continue;
    const key = format(new Date(t.due_date), "yyyy-MM-dd");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return map;
});

function tasksFor(date: Date): TaskDocType[] {
  return tasksByDate.value.get(format(date, "yyyy-MM-dd")) ?? [];
}

function isToday(date: Date) {
  return format(date, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");
}

function openTask(taskId: string) {
  navigateTo(`/workspace/${props.workspaceId}/tasks/${taskId}`);
}
</script>

<template>
  <div class="rounded-xl border bg-card p-5 shadow-sm">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-base font-semibold tracking-tight">This Week</h2>
      <span class="text-sm text-muted-foreground">
        {{ format(weekStart, "MMM d") }} – {{ format(addDays(weekStart, 6), "MMM d") }}
      </span>
    </div>

    <div class="grid grid-cols-7 gap-1.5">
      <div
        v-for="date in weekDays"
        :key="date.toISOString()"
        class="flex min-h-32 flex-col rounded-lg border bg-background/50"
        :class="isToday(date) && 'ring-2 ring-brand/40'"
      >
        <div class="border-b px-2 py-1.5 text-center">
          <p class="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {{ format(date, "EEE") }}
          </p>
          <p
            class="text-sm font-semibold tabular-nums"
            :class="isToday(date) ? 'text-brand' : 'text-foreground'"
          >
            {{ format(date, "d") }}
          </p>
        </div>
        <div class="flex flex-1 flex-col gap-1 overflow-hidden p-1">
          <button
            v-for="task in tasksFor(date).slice(0, 3)"
            :key="task.id"
            type="button"
            class="cursor-pointer truncate rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-snug transition-colors hover:bg-brand/10"
            :class="
              task.status === 'completed'
                ? 'border-green-500/20 bg-green-500/5 text-muted-foreground line-through'
                : 'border-brand/20 bg-brand/5 text-foreground'
            "
            @click="openTask(task.id)"
          >
            {{ task.name }}
          </button>
          <p v-if="tasksFor(date).length > 3" class="px-1 text-[10px] text-muted-foreground">
            +{{ tasksFor(date).length - 3 }} more
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
