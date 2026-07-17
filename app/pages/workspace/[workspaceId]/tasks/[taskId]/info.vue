<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const route = useRoute();
const taskId = route.params.taskId as string;

const taskName = ref<string | null>(null);

if (import.meta.client) {
  useRxDbSafe().then((db) => {
    if (!db) return;
    const sub = db.tasks.findOne(taskId).$.subscribe((doc) => {
      taskName.value = doc?.name ?? null;
    });
    onUnmounted(() => sub.unsubscribe());
  });
}

const taskTitle = useWorkspacePageTitle("Task Details", taskName);
useSeoMeta({
  title: taskTitle,
  description: "View and update task details, status, and assignments.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>Task Details</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
