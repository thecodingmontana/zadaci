<script setup lang="ts">
import type { ProjectDocType, TaskDocType } from "~/plugins/rxdb.client";
import { computed } from "vue";
import { Skeleton } from "~/components/ui/skeleton";

const props = defineProps<{
  projects: ProjectDocType[];
  tasks: TaskDocType[];
  loading: boolean;
}>();

const topLevelTasks = computed(() => props.tasks.filter((t) => !t.parent_task_id && !t.deleted_at));

const totalProjects = computed(() => props.projects.filter((p) => !p.deleted_at).length);
const totalTasks = computed(() => topLevelTasks.value.length);
const totalTasksInProgress = computed(
  () => topLevelTasks.value.filter((t) => t.status === "in_progress").length,
);
const totalTasksCompleted = computed(
  () => topLevelTasks.value.filter((t) => t.status === "completed").length,
);

const loadingArray = [1, 2, 3, 4];

const cards = computed(() => [
  {
    title: "Total Projects",
    icon: "solar:folder-with-files-outline",
    value: totalProjects.value,
    suffix: "/ active",
  },
  {
    title: "Total Tasks",
    icon: "hugeicons:task-01",
    value: totalTasks.value,
    suffix: "/ created",
  },
  {
    title: "In Progress",
    icon: "solar:alarm-outline",
    value: totalTasksInProgress.value,
    suffix: "/ tasks",
  },
  {
    title: "Completed",
    icon: "solar:check-circle-outline",
    value: totalTasksCompleted.value,
    suffix: "/ tasks",
  },
]);
</script>

<template>
  <div>
    <div v-if="props.loading" class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <div v-for="n in loadingArray" :key="n" class="grid gap-y-1.5 rounded-md border p-5">
        <Skeleton class="h-3 w-1/2" />
        <div class="flex items-center gap-3">
          <Skeleton class="size-8 shrink-0 rounded-md md:size-10" />
          <div class="grid w-full shrink-0 gap-1">
            <Skeleton class="h-4 w-full" />
            <Skeleton class="h-2 w-1/2" />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <div v-for="card in cards" :key="card.title" class="grid gap-y-2 rounded-md border p-5">
        <h3 class="text-sm font-semibold text-muted-foreground uppercase">{{ card.title }}</h3>
        <div class="flex items-center gap-x-3">
          <Icon :name="card.icon" size="35" class="shrink-0" />
          <p class="text-3xl">
            {{ card.value }}
            <span class="text-base text-muted-foreground">{{ card.suffix }}</span>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
