<script setup lang="ts">
import ProjectDetailHeader from "~/components/workspace/projects/project-detail-header.vue";
import ProjectDetailMeta from "~/components/workspace/projects/project-detail-meta.vue";
import ProjectDetailToolbar from "~/components/workspace/projects/project-detail-toolbar.vue";
import ProjectTaskKanban from "~/components/workspace/projects/tasks/project-task-kanban.vue";

definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const route = useRoute();
const workspaceId = route.params.workspaceId as string;
const projectId = route.params.projectId as string;

console.log("[project-page] mounted, projectId:", projectId, "workspaceId:", workspaceId);

const { project, currentStatus, timeline, milestones, milestoneProgress } =
  useProjectDetail(projectId);

const projectName = computed(() => {
  const name = project.value?.title ?? null;
  console.log("[project-page] projectName computed:", name);
  return name;
});

const projectTitle = useWorkspacePageTitle("Project Details", projectName);
useSeoMeta({
  title: projectTitle,
  description: "View and manage project details, tasks, and team members.",
});

const activeView = ref<"table" | "kanban" | "timeline">("kanban");
const searchQuery = ref("");

watch(project, (val) => {
  if (!val || val.deleted_at) {
    navigateTo(`/workspace/${workspaceId}/projects/all`, { replace: true });
  }
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
            @click="navigateTo(`/workspace/${workspaceId}/projects/all`)"
          >
            <Icon name="solar:arrow-left-linear" class="size-4" />
          </Button>
          <NuxtLink
            :to="`/workspace/${workspaceId}/projects/all`"
            class="transition-colors hover:text-foreground"
          >
            Projects
          </NuxtLink>
          <span>/</span>
          <span class="font-medium text-foreground">
            {{ projectName ?? "Untitled" }}
          </span>
        </div>

        <ProjectDetailHeader
          :project-id="projectId"
          :workspace-id="workspaceId"
          :title="projectName"
        />

        <Separator />

        <ProjectDetailMeta
          :project-id="projectId"
          :workspace-id="workspaceId"
          :status="currentStatus!"
          :description="project?.description ?? null"
          :timeline="timeline"
          :milestones="milestones"
          :milestone-progress="milestoneProgress"
          :project-status="project?.status ?? 'idea'"
          :project-due-date="project?.due_date ?? null"
        />

        <Separator />

        <ProjectDetailToolbar
          v-model:active-view="activeView"
          v-model:search-query="searchQuery"
          :workspace-id="workspaceId"
          :project-id="projectId"
          :project-title="projectName ?? 'Untitled'"
        />

        <!-- Task board area -->
        <Motion
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :transition="{ duration: 0.3, delay: 0.3 }"
          class="min-h-[500px] flex-1"
        >
          <ProjectTaskKanban
            v-if="activeView === 'kanban'"
            :workspace-id="workspaceId"
            :project-id="projectId"
            :project-title="projectName ?? 'Untitled'"
          />
          <div
            v-else-if="activeView === 'table'"
            class="flex h-full items-center justify-center rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
          >
            Table view goes here
          </div>
          <div
            v-else
            class="flex h-full items-center justify-center rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
          >
            Timeline view goes here
          </div>
        </Motion>
      </Motion>
    </NuxtLayout>
  </NuxtLayout>
</template>
