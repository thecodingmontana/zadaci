<script setup lang="ts">
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

function addTask() {
  modalStore?.setModalData({ workspaceId });
  modalStore?.onOpen("addNewTask");
  modalStore?.setIsOpen(true);
}

const stats = useDashboardStats(() => workspaceId);

// ── Stat card definitions ──
const statCards = computed(() => [
  {
    id: "active-projects",
    title: "Active Projects",
    value: stats.activeProjects.value,
    icon: "solar:folder-with-files-bold",
    trend: stats.activeProjectTrend.value,
    caption: `${stats.projects.value.length} total`,
  },
  {
    id: "completed",
    title: "Task Completed",
    value: stats.completedTasks.value,
    icon: "solar:check-circle-bold",
    trend: stats.completedTrend.value,
    caption: "vs last month",
  },
  {
    id: "pending",
    title: "Pending Tasks",
    value: stats.pendingTasks.value,
    icon: "solar:clock-circle-bold",
    trend: stats.pendingTrend.value,
    caption: `${stats.pendingTasks.value} still open`,
  },
  {
    id: "upcoming",
    title: "Upcoming Deadlines",
    value: stats.upcomingDeadlines.value,
    icon: "solar:calendar-bold",
    trend: null,
    caption: "due in the next 7 days",
  },
  {
    id: "overdue",
    title: "Overdue Tasks",
    value: stats.overdueTasks.value,
    icon: "solar:alert-circle-bold",
    trend: null,
    caption: "past due & still open",
  },
]);
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <Motion
        :initial="{ opacity: 0, y: 8 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.35, ease: 'easeOut' }"
        class="flex flex-col gap-6 p-6"
      >
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 class="text-xl font-semibold tracking-tight">Dashboard</h1>
            <p class="text-sm text-muted-foreground">
              Live overview from your workspace — updates in real time.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Button size="sm" class="gap-1.5 bg-brand hover:bg-brand-secondary" @click="addTask">
              <Icon name="solar:add-circle-linear" class="size-4" />
              Add Task
            </Button>
          </div>
        </div>

        <!-- Stat cards -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            v-for="card in statCards"
            :key="card.id"
            :title="card.title"
            :value="card.value"
            :icon="card.icon"
            :trend="card.trend"
            :caption="card.caption"
          />
        </div>
      </Motion>
    </NuxtLayout>
  </NuxtLayout>
</template>
