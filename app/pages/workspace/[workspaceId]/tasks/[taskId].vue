<script setup lang="ts">
import type { TaskDocType } from "~/plugins/rxdb.client";
import { Button } from "~/components/ui/button";
import CommentSection from "~/components/workspace/comment-section.vue";
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
  description: "View and update task details, status, and assignments.",
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
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div class="flex flex-col gap-6 p-6">
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

        <div>
          <h1 class="text-xl font-semibold tracking-tight">{{ taskName ?? "Untitled" }}</h1>
        </div>

        <Separator />

        <CommentSection :workspace-id="workspaceId" entity-type="task" :entity-id="taskId" />
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>
