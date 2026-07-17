<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

useSeoMeta({
  title: "Help & Support",
  description: "Get help and support for using Zadaci workspace features.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>Help & Support</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
