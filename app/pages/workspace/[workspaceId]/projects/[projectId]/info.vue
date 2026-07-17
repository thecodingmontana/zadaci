<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const route = useRoute();
const projectId = route.params.projectId as string;

const projectName = ref<string | null>(null);

if (import.meta.client) {
  useRxDbSafe().then((db) => {
    if (!db) return;
    const sub = db.projects.findOne(projectId).$.subscribe((doc) => {
      projectName.value = doc?.title ?? null;
    });
    onUnmounted(() => sub.unsubscribe());
  });
}

const projectTitle = useWorkspacePageTitle("Project Details", projectName);
useSeoMeta({
  title: projectTitle,
  description: "View and manage project details, tasks, and team members.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>Project Details</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
