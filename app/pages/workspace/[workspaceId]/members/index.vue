<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

useSeoMeta({
  title: "Members",
  description: "View and manage workspace members and their roles.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>Members</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
