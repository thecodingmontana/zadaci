<script setup lang="ts">
import { Motion } from "motion-v";
import AllTasksStats from "~/components/dashboard/all-tasks-stats.vue";
import ContributionGrid from "~/components/dashboard/contribution-grid.vue";
import DashboardGreetings from "~/components/dashboard/dashboard-greetings.vue";
import ProjectStats from "~/components/dashboard/project-stats.vue";
import StatCard from "~/components/dashboard/stat-card.vue";
import { useContributions } from "~/composables/use-contributions";
import { useContributionsRealtime } from "~/composables/use-contributions-realtime";
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

const dateRange = ref<"today" | "daily" | "weekly" | "monthly" | "yearly">("daily");

const dateRanges = [
  { value: "today", label: "Today" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;

function addTask() {
  modalStore?.setModalData({ workspaceId });
  modalStore?.onOpen("addNewTask");
  modalStore?.setIsOpen(true);
}

const stats = useDashboardStats(() => workspaceId);

// ── Tier 2 per-user contributions (login, task/project created, etc.) ──
const contributions = useContributions();
const contributionsRealtime = useContributionsRealtime();
contributionsRealtime.start();

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
            <DashboardGreetings />
            <p class="flex items-center gap-2 text-sm text-muted-foreground">
              <span class="relative flex size-2">
                <span
                  class="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75"
                />
                <span class="relative inline-flex size-2 rounded-full bg-green-500" />
              </span>
              Last sync: just now — live RxDB + realtime updates.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <div class="inline-flex items-center rounded-lg border bg-card p-0.5 shadow-sm">
              <button
                v-for="range in dateRanges"
                :key="range.value"
                type="button"
                class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                :class="
                  dateRange === range.value
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                "
                @click="dateRange = range.value"
              >
                {{ range.label }}
              </button>
            </div>
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

        <!-- Contribution Grid -->
        <div class="rounded-xl border bg-card p-5 shadow-sm">
          <ContributionGrid
            :data="contributions.data.value ?? []"
            :weeks="53"
            accent="var(--brand)"
          />
        </div>

        <!-- Productivity Overview -->
        <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div class="xl:col-span-2">
            <ProductivityOverview
              title="Productivity Overview"
              :series="stats.productivitySeries.value"
              :month="stats.productivityMonth.value"
              :total="stats.productivityTotal.value"
              :avg="stats.productivityAvg.value"
              :trend="stats.productivityTrend.value"
              :on-prev-month="() => stats.shiftProductivityMonth(-1)"
              :on-next-month="() => stats.shiftProductivityMonth(1)"
            />
          </div>
          <ProjectOverview
            :workspace-id="workspaceId"
            :projects="stats.projects.value"
            :tasks="stats.tasks.value"
            :on-view-project="
              (taskId: string) => navigateTo(`/workspace/${workspaceId}/tasks/${taskId}`)
            "
          />
        </div>

        <!-- Donut stats -->
        <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div class="rounded-xl border bg-card p-5 shadow-sm">
            <AllTasksStats :tasks="stats.tasks.value" />
          </div>
          <div class="rounded-xl border bg-card p-5 shadow-sm">
            <ProjectStats :projects="stats.projects.value" />
          </div>
        </div>

        <!-- Recent Tasks -->
        <RecentTasks
          :workspace-id="workspaceId"
          :projects="stats.projects.value"
          :tasks="stats.tasks.value"
          :range="dateRange"
        />
      </Motion>
    </NuxtLayout>
  </NuxtLayout>
</template>
