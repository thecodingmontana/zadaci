<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const calendarTitle = useWorkspacePageTitle("Calendar");
useSeoMeta({
  title: calendarTitle,
  description: "View your workspace calendar with tasks, deadlines, and events.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>Calendar</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
