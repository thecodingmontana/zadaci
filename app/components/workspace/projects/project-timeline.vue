<script setup lang="ts">
import type { ProjectDocType } from "~/plugins/rxdb.client";
import { useWorkspaceProjects } from "~/composables/use-workspace-projects";

const props = defineProps<{
  workspaceId: string;
}>();

const { activeProjects } = useWorkspaceProjects(() => props.workspaceId);

const statusColors: Record<ProjectDocType["status"], string> = {
  idea: "bg-gray-400",
  todo: "bg-blue-500",
  in_progress: "bg-amber-500",
  in_review: "bg-purple-500",
  completed: "bg-green-500",
  abandoned: "bg-red-500",
};

const statusLabel: Record<ProjectDocType["status"], string> = {
  idea: "Idea",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  completed: "Completed",
  abandoned: "Abandoned",
};

const DAY_MS = 86_400_000;

const scheduledProjects = computed(() =>
  activeProjects.value
    .filter((p) => p.due_date && !Number.isNaN(new Date(p.due_date).getTime()))
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()),
);

const unscheduledProjects = computed(() =>
  activeProjects.value.filter((p) => !p.due_date || Number.isNaN(new Date(p.due_date).getTime())),
);

const today = computed(() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
});

const range = computed(() => {
  if (scheduledProjects.value.length === 0) {
    return { start: today.value, end: new Date(today.value.getTime() + 30 * DAY_MS) };
  }
  const first = scheduledProjects.value[0]?.due_date
    ? new Date(scheduledProjects.value[0].due_date)
    : today.value;
  const last = scheduledProjects.value[scheduledProjects.value.length - 1]?.due_date
    ? new Date(scheduledProjects.value[scheduledProjects.value.length - 1].due_date!)
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

function dueOffset(project: ProjectDocType) {
  if (!project.due_date) return 0;
  const d = new Date(project.due_date);
  d.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(dateToOffset(d)));
}

function barWidth(project: ProjectDocType) {
  const created = project.created_at ? new Date(project.created_at) : today.value;
  created.setHours(0, 0, 0, 0);
  const due = project.due_date ? new Date(project.due_date) : today.value;
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

function openProject(project: ProjectDocType) {
  navigateTo(`/workspace/${props.workspaceId}/projects/${project.id}`);
}

const isOverdue = (project: ProjectDocType) => {
  if (!project.due_date) return false;
  if (project.status === "completed" || project.status === "abandoned") return false;
  const d = new Date(project.due_date);
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
          {{ statusLabel[key as ProjectDocType["status"]] }}
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

        <!-- Scheduled project rows -->
        <div v-if="scheduledProjects.length > 0" class="space-y-2">
          <div v-for="project in scheduledProjects" :key="project.id" class="flex items-center">
            <div class="flex w-64 shrink-0 items-center gap-2 pe-3">
              <span class="size-2 shrink-0 rounded-full" :class="statusColors[project.status]" />
              <button
                class="truncate text-left text-sm font-medium hover:underline"
                @click="openProject(project)"
              >
                {{ project.title }}
              </button>
            </div>
            <div class="relative h-9 flex-1">
              <div
                class="absolute inset-y-0 border-l border-dashed"
                :style="{ left: `${dueOffset(project)}px` }"
              />
              <button
                class="absolute top-1/2 flex h-6 -translate-y-1/2 cursor-pointer items-center gap-1 rounded-md px-2 text-[11px] font-medium text-white shadow-sm transition-opacity hover:opacity-80"
                :class="[
                  statusColors[project.status],
                  isOverdue(project) && 'ring-2 ring-rose-500/70',
                ]"
                :style="{
                  left: `${dueOffset(project) - (barWidth(project) - dayWidth) / 2}px`,
                  width: `${Math.max(dayWidth, barWidth(project))}px`,
                  minWidth: `${dayWidth}px`,
                }"
                :title="`${project.title} — due ${formatBarDate(project.due_date!)}`"
                @click="openProject(project)"
              >
                <span class="truncate">{{ formatBarDate(project.due_date!) }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Unscheduled projects -->
        <div v-if="unscheduledProjects.length > 0" class="mt-6 border-t pt-4">
          <p class="mb-2 text-xs font-medium text-muted-foreground">
            No due date ({{ unscheduledProjects.length }})
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="project in unscheduledProjects"
              :key="project.id"
              class="flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
              @click="openProject(project)"
            >
              <span class="size-1.5 rounded-full" :class="statusColors[project.status]" />
              <span class="font-medium">{{ project.title }}</span>
            </button>
          </div>
        </div>

        <div
          v-if="activeProjects.length === 0"
          class="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground"
        >
          <Icon name="solar:calendar-linear" class="size-8" />
          No projects yet. Add one to see it here.
        </div>
      </div>
    </div>
  </div>
</template>
