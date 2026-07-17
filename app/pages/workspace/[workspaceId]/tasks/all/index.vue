<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>All Tasks</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
