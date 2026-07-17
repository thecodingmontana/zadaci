<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

useSeoMeta({
  title: "Project Details",
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
