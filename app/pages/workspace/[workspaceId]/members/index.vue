<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const membersTitle = useWorkspacePageTitle("Members");
useSeoMeta({
  title: membersTitle,
  description: "View and manage workspace members and their roles.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>Members</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
