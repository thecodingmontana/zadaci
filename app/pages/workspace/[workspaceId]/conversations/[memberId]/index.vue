<script setup lang="ts">
definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const route = useRoute();
const workspaceId = computed(() => route.params.workspaceId as string);
const memberId = computed(() => route.params.memberId as string);

const { data: members } = useWorkspaceMembers(workspaceId);

const memberName = computed(() => {
  return members.value?.find((m) => m.userId === memberId.value)?.user?.username ?? null;
});

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
