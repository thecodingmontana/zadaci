<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>Members</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
