<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

useSeoMeta({
  title: "All Tasks",
  description: "View and manage all tasks across your workspace projects.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>All Tasks</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
