<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

useSeoMeta({
  title: "Security Settings",
  description: "Manage your account security, password, and authentication methods.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>Security Settings</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
