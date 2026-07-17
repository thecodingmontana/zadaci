<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

useSeoMeta({
  title: "Profile Settings",
  description: "Update your profile information, avatar, and preferences.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>Profile Settings</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
