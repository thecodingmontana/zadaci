<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const route = useRoute();
const memberId = route.params.memberId as string;

const memberName = ref<string | null>(null);

if (import.meta.client) {
  useRxDbSafe().then((db) => {
    if (!db) return;
    const sub = db.workspace_members
      .findOne({ selector: { user_id: memberId } })
      .$.subscribe((doc) => {
        memberName.value = doc?.username ?? null;
      });
    onUnmounted(() => sub.unsubscribe());
  });
}

const conversationTitle = useWorkspacePageTitle("Conversation", memberName);
useSeoMeta({
  title: conversationTitle,
  description: "Direct messages — chat privately with your workspace members.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-area">
      <div>Conversation</div>
    </NuxtLayout>
  </NuxtLayout>
</template>
