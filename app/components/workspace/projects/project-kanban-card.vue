<script setup lang="ts">
import type { ProjectDocType } from "~/plugins/rxdb.client";
import { makeDraggable } from "@vue-dnd-kit/core";
import { useTemplateRef } from "vue";
import { Badge } from "~/components/ui/badge";

const props = defineProps<{
  project: ProjectDocType;
  index: number;
  items: ProjectDocType[];
}>();

const emit = defineEmits<{
  open: [projectId: string];
}>();

const el = useTemplateRef<HTMLElement>("el");

const { isDragging, isDragOver } = makeDraggable(
  el,
  {
    activation: { distance: 6 },
  },
  () => [props.index, props.items],
);

let didDrag = false;
let resetTimer: ReturnType<typeof setTimeout> | null = null;
watch(isDragging, (v) => {
  if (v) {
    didDrag = true;
  } else if (didDrag) {
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      didDrag = false;
      resetTimer = null;
    }, 50);
  }
});

function handleClick() {
  if (didDrag) {
    didDrag = false;
    if (resetTimer) clearTimeout(resetTimer);
    return;
  }
  emit("open", props.project.id);
}

const priorityStyles: Record<ProjectDocType["priority"], { badge: string; dot: string }> = {
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

const priorityLabel: Record<ProjectDocType["priority"], string> = {
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
  () => props.project.status === "completed" || props.project.status === "abandoned",
);
</script>

<template>
  <div
    ref="el"
    :data-index="index"
    class="cursor-grab rounded-md bg-background shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    :class="{
      'opacity-0': isDragging,
      'ring-2 ring-primary': isDragOver,
    }"
    @click="handleClick"
  >
    <div class="space-y-2 p-2.5">
      <div class="flex items-center justify-between gap-2">
        <Badge
          variant="secondary"
          class="gap-1 rounded px-1.5 py-0 text-[10px] font-medium capitalize"
          :class="priorityStyles[project.priority].badge"
        >
          <span class="size-1 rounded-full" :class="priorityStyles[project.priority].dot" />
          {{ priorityLabel[project.priority] }}
        </Badge>
        <Icon name="solar:folder-2-bold-duotone" class="size-4 text-muted-foreground" />
      </div>

      <p
        class="text-sm leading-snug font-semibold text-foreground"
        :class="isDone && 'text-muted-foreground line-through'"
      >
        {{ project.title }}
      </p>

      <p
        v-if="project.description"
        class="line-clamp-2 text-xs leading-relaxed text-muted-foreground"
        :class="isDone && 'line-through'"
      >
        {{ project.description }}
      </p>

      <div v-if="project.due_date" class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon name="solar:calendar-linear" class="size-3.5" />
        {{ formatDue(project.due_date) }}
      </div>
    </div>
  </div>
</template>
