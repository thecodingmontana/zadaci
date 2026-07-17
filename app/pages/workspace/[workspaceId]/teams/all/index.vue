<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

useSeoMeta({
  title: "All Teams",
  description: "Browse and manage teams within your workspace.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>All Teams</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
