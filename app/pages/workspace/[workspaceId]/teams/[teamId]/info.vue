<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const route = useRoute();
const teamId = route.params.teamId as string;

const teamName = ref<string | null>(null);

if (import.meta.client) {
  useRxDbSafe().then((db) => {
    if (!db) return;
    const sub = db.teams.findOne(teamId).$.subscribe((doc) => {
      teamName.value = doc?.name ?? null;
    });
    onUnmounted(() => sub.unsubscribe());
  });
}

const teamTitle = useWorkspacePageTitle("Team Details", teamName);
useSeoMeta({
  title: teamTitle,
  description: "View and manage team details, members, and projects.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>Team Details</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
