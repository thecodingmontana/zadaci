<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const projectsTitle = useWorkspacePageTitle("All Projects");
useSeoMeta({
  title: projectsTitle,
  description: "Browse and manage all projects in your workspace.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>All Projects</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
