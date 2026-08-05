<script setup lang="ts">
import type { TaskDocType } from "~/plugins/rxdb.client";
import { makeDraggable } from "@vue-dnd-kit/core";
import { useTemplateRef } from "vue";
import { Badge } from "~/components/ui/badge";

const props = defineProps<{
  task: TaskDocType;
  index: number;
  items: TaskDocType[];
  subtaskCount?: { total: number; completed: number };
}>();

const emit = defineEmits<{
  open: [taskId: string];
}>();

const el = useTemplateRef<HTMLElement>("el");

const { isDragging, isDragOver } = makeDraggable(
  el,
  {
    dragHandle: "[data-drag-handle]",
  },
  () => [props.index, props.items],
);

const priorityStyles: Record<TaskDocType["priority"], { badge: string; dot: string }> = {
  urgent: {
    badge: "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  high: {
    badge: "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  medium: {
    badge: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  low: {
    badge: "bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400",
    dot: "bg-purple-500",
  },
  none: {
    badge: "bg-zinc-100 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-400",
    dot: "bg-zinc-500",
  },
};

const priorityLabel: Record<TaskDocType["priority"], string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
};

function formatDue(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const isDone = computed(
  () => props.task.status === "completed" || props.task.status === "abandoned",
);
</script>

<template>
  <div
    ref="el"
    :data-index="index"
    class="cursor-pointer rounded-md bg-background shadow-sm transition-shadow hover:shadow-md"
    :class="{
      'opacity-0': isDragging,
      'ring-2 ring-primary': isDragOver,
    }"
    @click="emit('open', task.id)"
  >
    <div class="space-y-2 p-2.5">
      <div class="flex items-start justify-between gap-2">
        <Badge
          variant="secondary"
          class="gap-1 rounded px-1.5 py-0 text-[10px] font-medium capitalize"
          :class="priorityStyles[task.priority].badge"
        >
          <span class="size-1 rounded-full" :class="priorityStyles[task.priority].dot" />
          {{ priorityLabel[task.priority] }}
        </Badge>
        <span
          data-drag-handle
          class="cursor-grab text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
          role="button"
          tabindex="0"
          aria-label="Drag task"
        >
          <Icon name="lucide:grip-vertical" class="size-4" />
        </span>
      </div>

      <p
        class="text-sm leading-snug font-semibold text-foreground"
        :class="isDone && 'text-muted-foreground line-through'"
      >
        {{ task.name }}
      </p>

      <p
        v-if="task.description"
        class="line-clamp-2 text-xs leading-relaxed text-muted-foreground"
        :class="isDone && 'line-through'"
      >
        {{ task.description }}
      </p>

      <div
        v-if="subtaskCount && subtaskCount.total > 0"
        class="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Icon name="solar:checklist-linear" class="size-3.5" />
        {{ subtaskCount.completed }}/{{ subtaskCount.total }}
      </div>

      <div v-if="task.due_date" class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon name="solar:calendar-linear" class="size-3.5" />
        {{ formatDue(task.due_date) }}
      </div>
    </div>
  </div>
</template>
