<script setup lang="ts">
import type { ChatMessage, Thread } from "~/types/chat";
import { AnimatePresence, motion } from "motion-v";
import ChannelHeader from "~/components/workspace/channels/channel-header.vue";
import ChannelInfoPanel from "~/components/workspace/channels/channel-info-panel.vue";
import ThreadPanel from "~/components/workspace/channels/thread-panel.vue";

const route = useRoute();
const channelId = route.params.channelId as string;
const { state, toggleInfo, openThread, closeThread, closeInfo } = useChannelPanel(channelId);

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

async function onToggleReaction(messageId: string, emoji: string) {
  const db = await useRxDbSafe();
  if (!db) return;
  const doc = await db.messages.findOne(messageId).exec();
  if (!doc) return;

  const now = new Date().toISOString();
  await doc.incrementalModify((data: any) => {
    const reactions = data.reactions ?? [];
    const userReaction = reactions.find((r: any) => r.member_ids.includes(currentMemberId.value));
    const existingGroup = reactions.find((r: any) => r.emoji === emoji);

    if (userReaction?.emoji === emoji) {
      const idx = userReaction.member_ids.indexOf(currentMemberId.value);
      userReaction.member_ids.splice(idx, 1);
      if (userReaction.member_ids.length === 0) {
        reactions.splice(reactions.indexOf(userReaction), 1);
      }
    } else {
      if (userReaction) {
        const idx = userReaction.member_ids.indexOf(currentMemberId.value);
        userReaction.member_ids.splice(idx, 1);
        if (userReaction.member_ids.length === 0) {
          reactions.splice(reactions.indexOf(userReaction), 1);
        }
      }
      if (existingGroup) {
        existingGroup.member_ids.push(currentMemberId.value);
      } else {
        reactions.push({ emoji, member_ids: [currentMemberId.value] });
      }
    }

    data.reactions = reactions;
    data.updated_at = now;
    return data;
  });
}

function docToMessage(doc: any): ChatMessage {
  return {
    id: doc.id,
    channelId: doc.channel_id,
    authorId: doc.author_id,
    content: doc.content,
    createdAt: doc.created_at,
    editedAt: doc.edited_at,
    reactions: (doc.reactions ?? []) as any,
    parentMessageId: doc.parent_message_id,
    threadReplyCount: doc.thread_reply_count ?? 0,
    threadParticipantIds: doc.thread_participant_ids ?? [],
    threadLastReplyAt: doc.thread_last_reply_at,
    deletedAt: doc.deleted_at,
  };
}

async function onOpenThreadFromThread(messageId: string) {
  const db = await useRxDbSafe();
  if (!db) return;
  const parent = await db.messages.findOne(messageId).exec();
  if (!parent) return;
  const replies = await db.messages
    .find({
      selector: { parent_message_id: messageId, deleted_at: null },
      sort: [{ created_at: "asc" }],
    })
    .exec();
  const thread: Thread = {
    id: `thread-${messageId}`,
    parentMessageId: messageId,
    parentMessage: docToMessage(parent),
    replies: (replies ?? []).map(docToMessage),
  };
  openThread(thread);
}

async function onDeleteMessage(messageId: string) {
  const db = await useRxDbSafe();
  if (!db) return;
  const doc = await db.messages.findOne(messageId).exec();
  if (!doc) return;

  const parentMessageId = doc.parent_message_id;

  await doc.incrementalModify((data: any) => {
    data.deleted_at = new Date().toISOString();
    data.updated_at = data.deleted_at;
    return data;
  });

  // If this was a thread reply, decrement parent's reply count
  if (parentMessageId) {
    const parent = await db.messages.findOne(parentMessageId).exec();
    if (parent) {
      await parent.incrementalModify((data: any) => {
        data.thread_reply_count = Math.max(0, (data.thread_reply_count ?? 0) - 1);
        data.updated_at = new Date().toISOString();
        return data;
      });
    }
  }
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

  const parent = await db.messages.findOne(parentMessageId).exec();
  if (parent) {
    await parent.incrementalModify((data: any) => {
      const participantIds = [
        ...new Set([...(data.thread_participant_ids ?? []), currentMemberId.value]),
      ];
      data.thread_reply_count = (data.thread_reply_count ?? 0) + 1;
      data.thread_participant_ids = participantIds;
      data.thread_last_reply_at = now;
      data.updated_at = now;
      return data;
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
          @toggle-reaction="onToggleReaction"
          @open-thread="onOpenThreadFromThread"
          @delete="onDeleteMessage"
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
