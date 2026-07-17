<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

useSeoMeta({
  title: "Channel",
  description: "Workspace channel — collaborate and communicate with your team in real time.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>Channel</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
