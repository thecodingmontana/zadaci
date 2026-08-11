<script setup lang="ts">
import AllTasksStats from "~/components/dashboard/all-tasks-stats.vue";
import DashboardGreetings from "~/components/dashboard/dashboard-greetings.vue";
import OverallStats from "~/components/dashboard/overall-stats.vue";
import ProjectStats from "~/components/dashboard/project-stats.vue";
import WeeklyTasksProductivity from "~/components/dashboard/weekly-tasks-productivity.vue";
import { useModalStore } from "~/stores/use-modal-store";

definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const route = useRoute();
const workspaceId = route.params.workspaceId as string;
const dashboardTitle = useWorkspacePageTitle("Dashboard");
useSeoMeta({
  title: dashboardTitle,
  description: "Workspace dashboard — overview of your projects, tasks, and team activity.",
});

const modalStore = useModalStore();
const stats = useDashboardStats(() => workspaceId);

function onAddNewProject() {
  modalStore?.onOpen("addNewProject");
  modalStore?.setIsOpen(true);
}
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div class="grid grid-cols-1 gap-10 p-6 md:grid-cols-4">
        <!-- Error state -->
        <div
          v-if="stats.isError.value"
          class="col-span-1 flex flex-col items-center justify-center gap-3 py-12 md:col-span-4"
        >
          <p class="text-sm text-muted-foreground">Couldn't load dashboard data.</p>
          <Button variant="outline" size="sm" @click="stats.refetch()"> Retry </Button>
        </div>
        <template v-else>
          <!-- Left column -->
          <div class="col-span-1 flex flex-col gap-8 self-start md:col-span-2 xl:col-span-3">
            <div
              class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center lg:items-center"
            >
              <DashboardGreetings />
              <Button
                class="w-full bg-brand hover:bg-brand-secondary sm:w-fit md:w-full lg:w-fit dark:text-white"
                @click="onAddNewProject"
              >
                <Icon name="solar:add-circle-linear" class="size-5" />
                New project
              </Button>
            </div>
            <OverallStats
              :projects="stats.projects.value"
              :tasks="stats.tasks.value"
              :loading="stats.isLoading.value"
            />
            <WeeklyTasksProductivity :tasks="stats.tasks.value" :loading="stats.isLoading.value" />
          </div>
          <!-- Right column -->
          <div class="col-span-1 flex flex-col gap-8 self-start md:col-span-2 xl:col-span-1">
            <div class="rounded-md border p-5">
              <ProjectStats :projects="stats.projects.value" :loading="stats.isLoading.value" />
            </div>
            <div class="rounded-md border p-5">
              <AllTasksStats :tasks="stats.tasks.value" :loading="stats.isLoading.value" />
            </div>
          </div>
        </template>
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>
