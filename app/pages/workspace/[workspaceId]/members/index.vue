<script setup lang="ts">
import MembersTabs from "~/components/workspace/members/memmbers-tabs.vue";
import { useWorkspaceStore } from "~/stores/use-workspace-store";

definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const store = useWorkspaceStore();
const route = useRoute();
const workspaceId = computed(() => route.params.workspaceId as string);

const workspace = computed(() => store.activeWorkspace);

const canManageMembers = computed(() => {
  const role = workspace.value?.userRole ?? "member";
  return role === "owner" || role === "moderator";
});

watch(
  [workspace, canManageMembers],
  ([ws, can]) => {
    if (ws && !can) {
      navigateTo(`/workspace/${workspaceId.value}/dashboard`);
    }
  },
  { immediate: true },
);

const { data: members, status: membersStatus } = useWorkspaceMembers(workspaceId, {
  enabled: computed(() => canManageMembers.value),
});

const { data: invites, status: invitesStatus } = useWorkspaceInvites(workspaceId, {
  enabled: computed(() => canManageMembers.value),
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
      <section v-if="canManageMembers" class="space-y-4 p-3">
        <div>
          <h1 class="font-medium">Members Management</h1>
          <p class="max-w-2xl text-sm text-muted-foreground">
            Manage your team members and their account permissions access in the workspace.
          </p>
        </div>

        <MembersTabs
          :members="members ?? []"
          :invites="invites ?? []"
          :members-status="membersStatus"
          :invites-status="invitesStatus"
        />
      </section>
    </NuxtLayout>
  </NuxtLayout>
</template>
