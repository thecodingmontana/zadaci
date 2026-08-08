<script setup lang="ts">
import WorkspaceTaskKanban from "~/components/workspace/tasks/workspace-task-kanban.vue";
import WorkspaceTaskTimeline from "~/components/workspace/tasks/workspace-task-timeline.vue";
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

        <div class="flex items-start justify-between">
          <div class="flex items-center gap-2.5">
            <div class="flex size-8 items-center justify-center rounded-md bg-muted">
              <Icon name="solar:checklist-bold-duotone" class="size-5 text-muted-foreground" />
            </div>
            <h1 class="text-xl font-semibold tracking-tight">All Tasks</h1>
          </div>
        </div>

        <Separator />

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

          <div class="flex items-center gap-2">
            <Button size="sm" class="gap-1.5 bg-brand hover:bg-brand-secondary" @click="addTask">
              <Icon name="solar:add-circle-linear" class="size-4" />
              Add Task
            </Button>
          </div>
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
