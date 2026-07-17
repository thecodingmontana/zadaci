<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>Profile Settings</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
