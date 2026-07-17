<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

useSeoMeta({
  title: "Conversation",
  description: "Direct messages — chat privately with your workspace members.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>Conversation</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
