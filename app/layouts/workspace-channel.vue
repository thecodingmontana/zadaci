<script setup lang="ts">
import { AnimatePresence, motion } from "motion-v";
import ChannelHeader from "~/components/workspace/channels/channel-header.vue";
import ChannelInfoPanel from "~/components/workspace/channels/channel-info-panel.vue";
import ThreadPanel from "~/components/workspace/channels/thread-panel.vue";

const route = useRoute();
const channelId = route.params.channelId as string;
const { state, toggleInfo, closeThread, closeInfo } = useChannelPanel(channelId);

const currentMemberId = ref("me");

// Resolve current member from workspace members
const workspaceId = route.params.workspaceId as string;
const workspaceIdRef = computed(() => workspaceId);
const { data: members } = useWorkspaceMembers(workspaceIdRef);
const { user: authUser } = useUserSession();
watch(
  () => members.value,
  (val) => {
    if (!val || !authUser.value?.id) return;
    const member = val.find((m: any) => m.userId === authUser.value!.id);
    if (member) currentMemberId.value = member.id;
  },
  { immediate: true },
);

function generateId(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function onReply(parentMessageId: string, content: string) {
  if (!currentMemberId.value) return;
  const db = await useRxDbSafe();
  if (!db) return;

  const now = new Date().toISOString();

  // Insert reply message
  await db.messages.insert({
    id: generateId(),
    channel_id: channelId,
    author_id: currentMemberId.value,
    content,
    edited_at: null,
    reactions: [],
    parent_message_id: parentMessageId,
    thread_reply_count: 0,
    thread_participant_ids: [],
    thread_last_reply_at: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });

  // Update parent message thread metadata
  const parent = await db.messages.findOne(parentMessageId).exec();
  if (parent) {
    const participantIds = [...new Set([...parent.thread_participant_ids, currentMemberId.value])];
    await parent.patch({
      thread_reply_count: parent.thread_reply_count + 1,
      thread_participant_ids: participantIds,
      thread_last_reply_at: now,
      updated_at: now,
    });
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 overflow-hidden">
    <div class="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ChannelHeader :info-open="state.infoOpen" @toggle-info="toggleInfo" />
      <slot />
    </div>

    <AnimatePresence mode="wait">
      <motion.div
        v-if="state.infoOpen || state.activeThread"
        :key="state.activeThread ? 'thread' : 'info'"
        :initial="{ width: 0, opacity: 0 }"
        :animate="{ width: state.activeThread ? 360 : 320, opacity: 1 }"
        :exit="{ width: 0, opacity: 0 }"
        :transition="{ duration: 0.2, ease: 'easeOut' }"
        class="h-full overflow-hidden"
      >
        <ThreadPanel
          v-if="state.activeThread"
          :thread="state.activeThread"
          :current-member-id="currentMemberId"
          @close="closeThread"
          @reply="onReply"
        />
        <ChannelInfoPanel
          v-else
          :channel-id="channelId"
          :workspace-id="workspaceId"
          @close="closeInfo"
        />
      </motion.div>
    </AnimatePresence>
  </div>
</template>
