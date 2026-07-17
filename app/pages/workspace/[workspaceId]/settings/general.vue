<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

useSeoMeta({
  title: "General Settings",
  description: "Manage workspace general settings, name, and preferences.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>General Settings</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
