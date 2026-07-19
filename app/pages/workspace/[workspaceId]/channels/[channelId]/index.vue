<script setup lang="ts">
import type { RxCollection } from "rxdb";
import type { MessageDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
import type { Thread } from "~/types/chat";
import ChannelComposer from "~/components/workspace/channels/channel-composer.vue";
import ChannelMessages from "~/components/workspace/channels/channel-messages.vue";

definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const route = useRoute();
const workspaceId = route.params.workspaceId as string;
const channelId = route.params.channelId as string;

const channelName = ref<string | null>(null);
const currentMemberId = ref<string>("");

const { state: _state, openThread } = useChannelPanel(channelId);

const db = ref<ZadaciDatabase | null>(null);
const messageCollection = ref<RxCollection<MessageDocType> | null>(null);

const {
  messages,
  loading,
  hasMore: _hasMore,
  loadingMore: _loadingMore,
  loadInitial,
  loadOlder,
  subscribe,
  unsubscribe,
  docToMessage,
} = useMessageWindow(messageCollection, channelId);

const hasLoaded = ref(false);
const systemEvents = ref<any[]>([]);

const workspaceIdRef = computed(() => workspaceId);
const { data: members } = useWorkspaceMembers(workspaceIdRef);

const messageSync = useMessageSync(() => channelId);
// const receiptSync = useMessageReceiptSync(() => channelId);

const channelSubRef = ref<{ unsubscribe: () => void } | null>(null);

console.log("[index] REGISTERING onUnmounted at top level");
onUnmounted(() => {
  console.log("[index] onUnmounted FIRED — cleaning up");
  channelSubRef.value?.unsubscribe();
  unsubscribe();
  messageSync.stop();
  // receiptSync.stop();
});

function generateId(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function init() {
  try {
    const rxdb = await useRxDbSafe();
    if (!rxdb) return;
    db.value = rxdb;
    messageCollection.value = rxdb.messages;

    // Start RxDB sync for messages and receipts
    try {
      await messageSync.start();
    } catch (e) {
      console.error("[index] messageSync.start() threw:", e);
    }
    // await receiptSync.start();

    // Subscribe to channel name
    channelSubRef.value = rxdb.channels.findOne(channelId).$.subscribe((doc) => {
      channelName.value = doc?.name ?? null;
    });

    // Subscribe to messages
    await loadInitial();
    subscribe();
    hasLoaded.value = true;
  } catch (e) {
    console.error("[index] init() threw:", e);
  }
}

// Resolve current member ID once workspace members load
const { user: authUser } = useUserSession();
watch(
  () => members.value,
  (val) => {
    if (!val || !authUser.value?.id) return;
    const member = val.find((m: any) => m.userId === authUser.value!.id);
    if (member) {
      currentMemberId.value = member.id;
    }
  },
  { immediate: true },
);

if (import.meta.client) {
  window.onerror = (msg, source, line, col, err) => {
    console.error("[global onerror]", { msg, source, line, col, err });
  };
  window.addEventListener("unhandledrejection", (e) => {
    console.error("[unhandledrejection]", e.reason);
  });
  init().catch((e) => {
    console.error("[index] init() threw:", e);
  });
}

async function onSend(content: string) {
  if (!db.value) return;
  console.log("[channel] onSend:", { content, channelId, currentMemberId: currentMemberId.value });
  const now = new Date().toISOString();
  await db.value.messages.insert({
    id: generateId(),
    channel_id: channelId,
    author_id: currentMemberId.value,
    content,
    edited_at: null,
    reactions: [],
    parent_message_id: null,
    thread_reply_count: 0,
    thread_participant_ids: [],
    thread_last_reply_at: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
}

async function onToggleReaction(messageId: string, emoji: string) {
  if (!db.value) return;
  const doc = await db.value.messages.findOne(messageId).exec();
  if (!doc) return;

  const reactions = [...(doc.reactions ?? [])];
  const existing = reactions.find((r) => r.emoji === emoji);

  if (existing) {
    const idx = existing.member_ids.indexOf(currentMemberId.value);
    if (idx !== -1) {
      existing.member_ids.splice(idx, 1);
      if (existing.member_ids.length === 0) {
        const groupIdx = reactions.indexOf(existing);
        reactions.splice(groupIdx, 1);
      }
    } else {
      existing.member_ids.push(currentMemberId.value);
    }
  } else {
    reactions.push({ emoji, member_ids: [currentMemberId.value] });
  }

  await doc.patch({ reactions, updated_at: new Date().toISOString() });
  console.log("[channel] onToggleReaction:", { messageId, emoji, reactions });
}

async function onEditMessage(messageId: string, newContent: string) {
  if (!db.value) return;
  const doc = await db.value.messages.findOne(messageId).exec();
  if (!doc) return;
  await doc.patch({
    content: newContent,
    edited_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  console.log("[channel] onEditMessage:", { messageId, newContent });
}

async function onOpenThread(messageId: string) {
  if (!db.value) return;

  const parent = await db.value.messages.findOne(messageId).exec();
  if (!parent) return;

  const replies = await db.value.messages
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

const channelTitle = useWorkspacePageTitle("Channel", channelName);
useSeoMeta({
  title: channelTitle,
  description: "Workspace channel — collaborate and communicate with your team in real time.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <NuxtLayout name="workspace-channel">
      <ChannelMessages
        :messages="messages"
        :system-events="systemEvents"
        :current-member-id="currentMemberId"
        :channel-name="channelName ?? undefined"
        :loading="loading"
        :has-loaded="hasLoaded"
        @toggle-reaction="onToggleReaction"
        @open-thread="onOpenThread"
        @edit-message="onEditMessage"
        @load-older="loadOlder"
      />
      <ChannelComposer @send="onSend" />
    </NuxtLayout>
  </NuxtLayout>
</template>
