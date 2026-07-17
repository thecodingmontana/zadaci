<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const route = useRoute();
const channelId = route.params.channelId as string;

const channelName = ref<string | null>(null);

if (import.meta.client) {
  useRxDbSafe().then((db) => {
    if (!db) return;
    const sub = db.channels.findOne(channelId).$.subscribe((doc) => {
      channelName.value = doc?.name ?? null;
    });
    onUnmounted(() => sub.unsubscribe());
  });
}

const channelTitle = useWorkspacePageTitle("Channel", channelName);
useSeoMeta({
  title: channelTitle,
  description: "Workspace channel — collaborate and communicate with your team in real time.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>Channel</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
