<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const dashboardTitle = useWorkspacePageTitle("Dashboard");
useSeoMeta({
  title: dashboardTitle,
  description: "Workspace dashboard — overview of your projects, tasks, and team activity.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>Welcome to Workspace Dashboard</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
