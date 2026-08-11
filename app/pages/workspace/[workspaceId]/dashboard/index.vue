<script setup lang="ts">
import { Motion } from "motion-v";
import AllTasksStats from "~/components/dashboard/all-tasks-stats.vue";
import DashboardGreetings from "~/components/dashboard/dashboard-greetings.vue";
import DashboardLoadingSkeleton from "~/components/dashboard/dashboard-loading-skeleton.vue";
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
      <Motion
        :initial="{ opacity: 0, y: 8 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.35, ease: 'easeOut' }"
        class="grid grid-cols-1 gap-10 p-6 md:grid-cols-4"
      >
        <!-- Loading skeleton -->
        <DashboardLoadingSkeleton v-if="!stats.loaded.value" />

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
              :loading="!stats.loaded.value"
            />

            <WeeklyTasksProductivity :tasks="stats.tasks.value" :loading="!stats.loaded.value" />
          </div>

          <!-- Right column -->
          <div class="col-span-1 flex flex-col gap-8 self-start md:col-span-2 xl:col-span-1">
            <div class="rounded-md border p-5">
              <ProjectStats :projects="stats.projects.value" :loading="!stats.loaded.value" />
            </div>
            <div class="rounded-md border p-5">
              <AllTasksStats :tasks="stats.tasks.value" :loading="!stats.loaded.value" />
            </div>
          </div>
        </template>
      </Motion>
    </NuxtLayout>
  </NuxtLayout>
</template>
