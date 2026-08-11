<script setup lang="ts">
import { computed } from "vue";
import WorkspaceTaskKanban from "~/components/workspace/tasks/workspace-task-kanban.vue";
import WorkspaceTaskTimeline from "~/components/workspace/tasks/workspace-task-timeline.vue";
import { useDashboardStats } from "~/composables/use-dashboard-stats";
import { useWorkspaceTasks } from "~/composables/use-workspace-tasks";
import { useModalStore } from "~/stores/use-modal-store";

definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const route = useRoute();
const workspaceId = route.params.workspaceId as string;

const tasksTitle = useWorkspacePageTitle("All Tasks");
useSeoMeta({
  title: tasksTitle,
  description: "View and manage all tasks across your workspace projects.",
});

const activeView = ref<"kanban" | "timeline">("kanban");

const modalStore = useModalStore();

function addTask() {
  modalStore?.setModalData({ workspaceId });
  modalStore?.onOpen("addNewTask");
  modalStore?.setIsOpen(true);
}

const stats = useDashboardStats(() => workspaceId);
const { topLevelTasks } = useWorkspaceTasks(() => workspaceId);

const statusCounts = computed(() => {
  const counts: Record<string, number> = {
    idea: 0,
    todo: 0,
    in_progress: 0,
    in_review: 0,
    completed: 0,
    abandoned: 0,
  };
  for (const t of topLevelTasks.value) {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  }
  return counts;
});
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
        <!-- Breadcrumb -->
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Button
            variant="ghost"
            size="icon"
            class="size-6"
            @click="navigateTo(`/workspace/${workspaceId}/dashboard`)"
          >
            <Icon name="solar:arrow-left-linear" class="size-4" />
          </Button>
          <NuxtLink
            :to="`/workspace/${workspaceId}/dashboard`"
            class="transition-colors hover:text-foreground"
          >
            Dashboard
          </NuxtLink>
          <span>/</span>
          <span class="font-medium text-foreground">Tasks</span>
        </div>

        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex items-center gap-2.5">
            <div class="flex size-8 items-center justify-center rounded-md bg-muted">
              <Icon name="solar:checklist-bold-duotone" class="size-5 text-muted-foreground" />
            </div>
            <div>
              <h1 class="text-xl font-semibold tracking-tight">All Tasks</h1>
              <p class="flex items-center gap-2 text-xs text-muted-foreground">
                <span class="relative flex size-2">
                  <span
                    class="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75"
                  />
                  <span class="relative inline-flex size-2 rounded-full bg-green-500" />
                </span>
                Last sync: just now — live RxDB updates.
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" class="gap-1.5">
              <Icon name="solar:download-linear" class="size-4" />
              Import Task
            </Button>
            <Button size="sm" class="gap-1.5 bg-brand hover:bg-brand-secondary" @click="addTask">
              <Icon name="solar:add-circle-linear" class="size-4" />
              Add Task
            </Button>
          </div>
        </div>

        <Separator />

        <!-- Overview cards -->
        <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div class="xl:col-span-2">
            <TaskStatusOverview :counts="statusCounts" />
          </div>
          <div class="flex flex-col gap-6">
            <StatusBreakdown :counts="statusCounts" />
          </div>
        </div>

        <!-- Stat cards -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Task Completed"
            :value="stats.completedTasks.value"
            icon="solar:check-circle-bold"
            :trend="stats.completedTrend.value"
            caption="vs last month"
          />
          <StatCard
            title="Pending Tasks"
            :value="stats.pendingTasks.value"
            icon="solar:clock-circle-bold"
            :trend="stats.pendingTrend.value"
            :caption="`${stats.pendingTasks.value} still open`"
          />
          <StatCard
            title="Upcoming Deadlines"
            :value="stats.upcomingDeadlines.value"
            icon="solar:calendar-bold"
            :trend="null"
            caption="due in the next 7 days"
          />
          <StatCard
            title="Overdue Tasks"
            :value="stats.overdueTasks.value"
            icon="solar:alert-circle-bold"
            :trend="null"
            caption="past due & still open"
          />
        </div>

        <!-- Task Calendar -->
        <TaskWeekCalendar :workspace-id="workspaceId" :tasks="stats.tasks.value" />

        <!-- View switcher -->
        <Motion
          :initial="{ opacity: 0, y: 6 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.3, delay: 0.2 }"
          class="flex items-center justify-between"
        >
          <Tabs v-model="activeView">
            <TabsList>
              <TabsTrigger value="kanban" class="gap-1.5">
                <Icon name="solar:widget-add-linear" class="size-4" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="timeline" class="gap-1.5">
                <Icon name="solar:chart-square-linear" class="size-4" />
                Timeline
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button variant="outline" size="sm" class="gap-1.5">
            <Icon name="solar:sort-horizontal-linear" class="size-4" />
            Sort
          </Button>
        </Motion>

        <!-- Board area -->
        <Motion
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :transition="{ duration: 0.3, delay: 0.3 }"
          class="min-h-[500px] flex-1"
        >
          <WorkspaceTaskKanban v-if="activeView === 'kanban'" :workspace-id="workspaceId" />
          <WorkspaceTaskTimeline v-else :workspace-id="workspaceId" />
        </Motion>
      </Motion>
    </NuxtLayout>
  </NuxtLayout>
</template>
