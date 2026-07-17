<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const securitySettingsTitle = useWorkspacePageTitle("Security Settings");
useSeoMeta({
  title: securitySettingsTitle,
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
