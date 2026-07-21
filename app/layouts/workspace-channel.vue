<script setup lang="ts">
import type { ChatMessage, Thread } from "~/types/chat";
import { AnimatePresence, motion } from "motion-v";
import ChannelHeader from "~/components/workspace/communication/channel/channel-header.vue";
import ChannelInfoPanel from "~/components/workspace/communication/channel/channel-info-panel.vue";
import ThreadPanel from "~/components/workspace/communication/shared/thread-panel.vue";
import { queryWithRetry } from "~/utils/rxdb-helpers";

const route = useRoute();
const channelId = route.params.channelId as string;
const { state, toggleInfo, openThread, closeThread, closeInfo } = useChannelPanel(channelId);

const currentMemberId = ref("me");

interface MemberInfo {
  name: string;
  avatar: string | null;
}

// Resolve current member from workspace members
const workspaceId = route.params.workspaceId as string;
const workspaceIdRef = computed(() => workspaceId);
const { data: members } = useWorkspaceMembers(workspaceIdRef);
const membersMap = computed(() => {
  if (!members.value) return new Map<string, MemberInfo>();
  const map = new Map<string, MemberInfo>();
  for (const m of members.value) {
    map.set(m.id, {
      name: m.user.username ?? m.user.email ?? m.id,
      avatar: m.user.profilePictureUrl,
    });
  }
  return map;
});
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
  const doc = await queryWithRetry(() => db.messages.findOne(messageId).exec());
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
  const parent = await queryWithRetry(() => db.messages.findOne(messageId).exec());
  if (!parent) return;
  const replies = await queryWithRetry(() =>
    db.messages
      .find({
        selector: { parent_message_id: messageId, deleted_at: null },
        sort: [{ created_at: "asc" }],
        limit: 50,
      })
      .exec(),
  );
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
  const doc = await queryWithRetry(() => db.messages.findOne(messageId).exec());
  if (!doc) return;

  const parentMessageId = doc.parent_message_id;

  await doc.incrementalModify((data: any) => {
    data.deleted_at = new Date().toISOString();
    data.updated_at = data.deleted_at;
    return data;
  });

  // If this was a thread reply, decrement parent's reply count
  if (parentMessageId) {
    const parent = await queryWithRetry(() => db.messages.findOne(parentMessageId).exec());
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

  const id = generateId();
  const now = new Date().toISOString();

  await db.messages.insert({
    id,
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

  const parent = await queryWithRetry(() => db.messages.findOne(parentMessageId).exec());
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

  try {
    const pushBody = [
      {
        assumedMasterState: null,
        newDocumentState: {
          id,
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
        },
      },
    ];
    await $fetch(`/api/replication/messages/push?channel_id=${channelId}`, {
      method: "POST",
      body: pushBody,
    });
  } catch {
    // ignore
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
          :members="membersMap"
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
