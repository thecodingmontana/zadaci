<script setup lang="ts">
import type { TaskDocType } from "~/plugins/rxdb.client";
import { Button } from "~/components/ui/button";
import CommentSection from "~/components/workspace/comment-section.vue";
import ProjectTaskKanban from "~/components/workspace/projects/tasks/project-task-kanban.vue";
import ProjectTaskTable from "~/components/workspace/projects/tasks/project-task-table.vue";
import ProjectTaskTimeline from "~/components/workspace/projects/tasks/project-task-timeline.vue";
import TaskDetailHeader from "~/components/workspace/tasks/task-detail-header.vue";
import TaskDetailMeta from "~/components/workspace/tasks/task-detail-meta.vue";
import TaskDetailToolbar from "~/components/workspace/tasks/task-detail-toolbar.vue";
import { useRxDbSafe } from "~/composables/use-rxdb";

definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const route = useRoute();
const taskId = route.params.taskId as string;
const workspaceId = route.params.workspaceId as string;

const task = ref<TaskDocType | null>(null);

const taskName = computed(() => task.value?.name ?? null);
const taskTitle = useWorkspacePageTitle("Task Details", taskName);
useSeoMeta({
  title: taskTitle,
  description: "View and update task details, status, and subtasks.",
});

onMounted(async () => {
  const db = await useRxDbSafe();
  if (!db) return;

  const taskSub = db.tasks.findOne(taskId).$.subscribe((doc) => {
    task.value = doc ?? null;
  });

  onUnmounted(() => {
    taskSub.unsubscribe();
  });
});

const projectId = computed(() => task.value?.project_id ?? "");
const activeView = ref<"table" | "kanban" | "timeline">("kanban");
const searchQuery = ref("");
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
            @click="navigateTo(`/workspace/${workspaceId}/tasks/all`)"
          >
            <Icon name="solar:arrow-left-linear" class="size-4" />
          </Button>
          <NuxtLink
            :to="`/workspace/${workspaceId}/tasks/all`"
            class="transition-colors hover:text-foreground"
          >
            Tasks
          </NuxtLink>
          <span>/</span>
          <span class="font-medium text-foreground">{{ taskName ?? "Untitled" }}</span>
        </div>

        <TaskDetailHeader :task="task" :workspace-id="workspaceId" :project-id="projectId" />

        <Separator />

        <TaskDetailMeta
          v-if="task"
          :task="task"
          :workspace-id="workspaceId"
          :project-id="projectId"
        />

        <Separator v-if="task" />

        <TaskDetailToolbar
          v-if="task"
          v-model:active-view="activeView"
          v-model:search-query="searchQuery"
          :workspace-id="workspaceId"
          :project-id="projectId"
          :project-title="taskName ?? 'Untitled'"
          :parent-task-id="taskId"
        />

        <!-- Subtask board area -->
        <Motion
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :transition="{ duration: 0.3, delay: 0.3 }"
          class="min-h-[500px] flex-1"
        >
          <ProjectTaskKanban
            v-if="activeView === 'kanban' && task"
            :workspace-id="workspaceId"
            :project-id="projectId"
            :project-title="taskName ?? 'Untitled'"
            :parent-task-id="taskId"
          />
          <ProjectTaskTable
            v-else-if="activeView === 'table' && task"
            v-model:search-query="searchQuery"
            :workspace-id="workspaceId"
            :project-id="projectId"
            :parent-task-id="taskId"
          />
          <ProjectTaskTimeline
            v-else-if="activeView === 'timeline' && task"
            :workspace-id="workspaceId"
            :project-id="projectId"
            :parent-task-id="taskId"
          />
          <div
            v-else
            class="flex h-full items-center justify-center rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
          >
            Task not found.
          </div>
        </Motion>

        <Separator />

        <CommentSection :workspace-id="workspaceId" entity-type="task" :entity-id="taskId" />
      </Motion>
    </NuxtLayout>
  </NuxtLayout>
</template>
