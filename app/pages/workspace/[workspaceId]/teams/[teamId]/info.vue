<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

useSeoMeta({
  title: "Team Details",
  description: "View and manage team details, members, and projects.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>Team Details</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
