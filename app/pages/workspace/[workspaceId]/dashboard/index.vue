<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>Welcome to Workspace Dashboard</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
