<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

useSeoMeta({
  title: "Task Details",
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
