<script setup lang="ts">
import type { ProjectDocType, TaskDocType } from "~/plugins/rxdb.client";
import { format, parseISO } from "date-fns";
import { computed, ref, watch } from "vue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const props = defineProps<{
  workspaceId: string;
  projects: ProjectDocType[];
  tasks: TaskDocType[];
  onViewProject: (projectId: string) => void;
}>();

const NOT_DONE = new Set(["idea", "todo", "in_progress", "in_review"]);

const activeProjects = computed(() => props.projects.filter((p) => NOT_DONE.has(p.status)));

const selectedId = ref<string | null>(null);

const selectedProject = computed<ProjectDocType | null>(() => {
  const list = activeProjects.value;
  if (list.length === 0) return null;
  const id = selectedId.value ?? list[0].id;
  return list.find((p) => p.id === id) ?? list[0];
});

watch(selectedProject, (p) => {
  if (p) selectedId.value = p.id;
});

const projectTasks = computed<TaskDocType[]>(() => {
  const project = selectedProject.value;
  if (!project) return [];
  return props.tasks.filter(
    (t) => t.project_id === project.id && !t.parent_task_id && !t.deleted_at,
  );
});

const progress = computed(() => {
  const tasks = projectTasks.value;
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === "completed").length;
  return Math.round((done / tasks.length) * 100);
});

const timeline = computed<{ id: string; title: string; dueDate: string }[]>(() => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return projectTasks.value
    .filter((t) => t.due_date && NOT_DONE.has(t.status))
    .map((t) => ({ id: t.id, title: t.title, dueDate: t.due_date! }))
    .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime())
    .slice(0, 4);
});

function dueLabel(iso: string): string {
  const date = parseISO(iso);
  return format(date, "MMM d");
}
</script>

<template>
  <div class="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-base font-semibold tracking-tight">Project Overview</h2>
      <Select
        v-if="activeProjects.length > 1"
        :model-value="selectedProject?.id"
        @update:model-value="(v: string) => (selectedId = v)"
      >
        <SelectTrigger class="h-8 w-fit max-w-40 gap-1 text-xs">
          <SelectValue placeholder="Select project" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="p in activeProjects" :key="p.id" :value="p.id" class="cursor-pointer">
            <span class="truncate">{{ p.title }}</span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <template v-if="selectedProject">
      <div>
        <h3 class="truncate text-sm font-medium">{{ selectedProject.title }}</h3>
        <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {{ selectedProject.description || "No description yet" }}
        </p>
      </div>

      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-xs">
          <span class="text-muted-foreground">Progress</span>
          <span class="font-medium tabular-nums">{{ progress }}%</span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-muted">
          <div
            class="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
            :style="{ width: `${progress}%` }"
          />
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Work Timeline
        </p>
        <div v-if="timeline.length" class="space-y-1.5">
          <button
            v-for="item in timeline"
            :key="item.id"
            type="button"
            class="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
            @click="onViewProject(item.id)"
          >
            <span class="truncate font-medium">{{ item.title }}</span>
            <span
              class="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand"
            >
              {{ dueLabel(item.dueDate) }}
              <Icon name="solar:arrow-right-linear" class="size-3" />
            </span>
          </button>
        </div>
        <p v-else class="text-xs text-muted-foreground">No upcoming deadlines for this project.</p>
      </div>
    </template>

    <p v-else class="py-6 text-center text-sm text-muted-foreground">No active projects yet.</p>
  </div>
</template>
