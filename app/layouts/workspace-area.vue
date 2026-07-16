<script setup lang="ts">
import WorkspaceHeader from "~/components/workspace/workspace-area/workspace-header.vue";

const route = useRoute();
const workspaceId = computed(() => route.params.workspaceId as string | undefined);
const wsId = () => workspaceId.value;

const taskSync = useTaskSync(wsId);
const projectSync = useProjectSync(wsId);
const teamSync = useTeamSync(wsId);
const tagSync = useTagSync(wsId);
const projectTagSync = useProjectTagSync(wsId);
const taskTagSync = useTaskTagSync(wsId);
const channelSync = useChannelSync(wsId);
const channelMemberSync = useChannelMemberSync(wsId);
const workspaceMemberSync = useWorkspaceMemberSync(wsId);
const userStatusSync = useUserStatusSync(wsId);

onMounted(async () => {
  await Promise.all([
    taskSync.start(),
    projectSync.start(),
    teamSync.start(),
    tagSync.start(),
    projectTagSync.start(),
    taskTagSync.start(),
    channelSync.start(),
    channelMemberSync.start(),
    workspaceMemberSync.start(),
    userStatusSync.start(),
  ]);
});
</script>

<template>
  <div>
    <WorkspaceHeader />
    <slot />
  </div>
</template>
