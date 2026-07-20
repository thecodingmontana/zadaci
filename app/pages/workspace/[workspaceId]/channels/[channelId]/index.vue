<script setup lang="ts">
import type { RxCollection } from "rxdb";
import type { MessageDocType, MessageReceiptDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
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

interface MemberInfo {
  name: string;
  avatar: string | null;
}

const channelName = ref<string | null>(null);
const currentMemberId = ref<string>("");

const { state: _state, openThread } = useChannelPanel(channelId);

const db = ref<ZadaciDatabase | null>(null);
const messageCollection = ref<RxCollection<MessageDocType> | null>(null);
const receiptCollection = ref<RxCollection<MessageReceiptDocType> | null>(null);

const pendingSendIds = ref(new Set<string>());

function addPending(id: string) {
  pendingSendIds.value = new Set(pendingSendIds.value).add(id);
}
function removePending(id: string) {
  const next = new Set(pendingSendIds.value);
  next.delete(id);
  pendingSendIds.value = next;
}

const {
  messages,
  loading,
  loadingMore,
  hasMore,
  hasMoreHistory,
  oldestTimestamp,
  loadInitial,
  loadOlder,
  loadHistoryFromServer,
  subscribe,
  unsubscribe,
  docToMessage,
} = useMessageWindow(messageCollection as Ref<RxCollection<MessageDocType> | null>, channelId);

const editingMessageId = ref<string | null>(null);
const editingContent = ref("");

const hasLoaded = ref(false);
const hasError = ref(false);
const systemEvents = ref<any[]>([]);

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

const messageSync = useMessageSync(() => channelId, {
  add: addPending,
  remove: removePending,
});
const receiptSync = useMessageReceiptSync(() => channelId);

const channelSubRef = ref<{ unsubscribe: () => void } | null>(null);

onUnmounted(() => {
  channelSubRef.value?.unsubscribe();
  unsubscribe();
  messageSync.stop();
  receiptSync.stop();
});

// Receipt subscription — rebuild when receipts change for delivery status
const receiptSub = ref<{ unsubscribe: () => void } | null>(null);

// Compute delivery status for each own message from receipts
const messageStatuses = ref<Map<string, "sending" | "sent" | "delivered" | "seen">>(new Map());
let lastReceiptQuery = 0;

function buildMessageStatuses() {
  const now = Date.now();
  console.log(`[channel] buildMessageStatuses — ${now}, messages count: ${messages.value.length}`);
  const statuses = new Map<string, "sending" | "sent" | "delivered" | "seen">();
  const col = receiptCollection.value;
  const ownMsgs = messages.value.filter((m) => m.authorId === currentMemberId.value);
  console.log(`[channel] buildMessageStatuses — ${ownMsgs.length} own messages`);
  for (const msg of ownMsgs) {
    if (pendingSendIds.value.has(msg.id)) {
      statuses.set(msg.id, "sending");
      console.log(`[channel] msg ${msg.id.slice(0, 8)} → sending (pending)`);
      continue;
    }
    statuses.set(msg.id, "sent");
  }
  // Override with receipt data if receipts are loaded
  if (col && lastReceiptQuery > 0) {
    console.log("[channel] buildMessageStatuses — checking receipts for status override");
    const allReceipts = col.find({ selector: {} }).exec();
    allReceipts.then((receiptDocs) => {
      for (const msg of ownMsgs) {
        const msgReceipts = receiptDocs.filter(
          (r) => r.message_id === msg.id && r.member_id !== currentMemberId.value,
        );
        if (msgReceipts.length === 0) continue;
        const hasSeen = msgReceipts.some((r) => r.status === "seen");
        const hasDelivered = msgReceipts.some((r) => r.status === "delivered");
        if (hasSeen) {
          statuses.set(msg.id, "seen");
          console.log(`[channel] msg ${msg.id.slice(0, 8)} → seen`);
        } else if (hasDelivered) {
          statuses.set(msg.id, "delivered");
          console.log(`[channel] msg ${msg.id.slice(0, 8)} → delivered`);
        }
      }
      messageStatuses.value = statuses;
    });
    return;
  }
  messageStatuses.value = statuses;
  console.log(`[channel] buildMessageStatuses done — ${statuses.size} statuses computed`);
}

function subscribeReceipts() {
  const col = receiptCollection.value;
  if (!col) {
    console.warn("[channel] subscribeReceipts — no receipt collection yet");
    return;
  }
  receiptSub.value?.unsubscribe();
  console.log(`[channel] subscribeReceipts — subscribing to message_receipts`);
  receiptSub.value = col
    .find({
      selector: {},
      sort: [{ updated_at: "desc" }],
      limit: 200,
    })
    .$.subscribe(async (docs) => {
      console.log(`[channel] receipt subscription fired — ${docs.length} docs`);
      for (const r of docs) {
        console.log(
          `[channel]   receipt: msg=${r.message_id.slice(0, 8)} member=${r.member_id.slice(0, 8)} status=${r.status}`,
        );
      }
      // Auto-mark new delivered receipts as "seen" for current user
      if (currentMemberId.value) {
        const myNewDelivered = docs.filter(
          (r) => r.member_id === currentMemberId.value && r.status === "delivered",
        );
        if (myNewDelivered.length > 0) {
          console.log(`[channel] auto-marking ${myNewDelivered.length} receipts as seen`);
          for (const r of myNewDelivered) {
            try {
              await r.patch({ status: "seen", updated_at: new Date().toISOString() });
            } catch (e) {
              console.warn("[channel] failed to mark receipt as seen:", e);
            }
          }
          console.log(`[channel] auto-marked ${myNewDelivered.length} as seen`);
        }
      }
      if (docs.length > 0) {
        lastReceiptQuery = Date.now();
        buildMessageStatuses();
      }
    });
}

function generateId(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function init() {
  console.log("[channel] init() started");
  hasError.value = false;
  try {
    const rxdb = await useRxDbSafe();
    if (!rxdb) {
      console.warn("[channel] init — no RxDB");
      hasError.value = true;
      return;
    }
    db.value = rxdb;
    messageCollection.value = rxdb.messages;
    receiptCollection.value = rxdb.message_receipts;
    console.log("[channel] init — collections acquired");

    // Start RxDB sync for messages
    try {
      console.log("[channel] starting messageSync...");
      await messageSync.start();
      console.log("[channel] messageSync started");
    } catch (e) {
      console.error("[channel] messageSync.start() threw:", e);
      hasError.value = true;
    }

    // Start RxDB sync for receipts
    try {
      console.log("[channel] starting receiptSync...");
      await receiptSync.start();
      console.log("[channel] receiptSync started");
    } catch (e) {
      console.error("[channel] receiptSync.start() threw:", e);
    }

    // Subscribe to channel name
    console.log("[channel] subscribing to channel name");
    channelSubRef.value = rxdb.channels.findOne(channelId).$.subscribe((doc) => {
      console.log("[channel] channel name update:", doc?.name);
      channelName.value = doc?.name ?? null;
    });

    // Subscribe to receipts
    subscribeReceipts();

    // Subscribe to messages
    console.log("[channel] loading initial messages");
    await loadInitial();
    subscribe();
    hasLoaded.value = true;
    console.log("[channel] init() complete");

    // Mark unread messages as "seen" for this user
    markMessagesAsSeen();
  } catch (e) {
    console.error("[channel] init() threw:", e);
    hasError.value = true;
  }
}

async function markMessagesAsSeen() {
  if (!db.value || !currentMemberId.value) {
    console.log("[channel] markMessagesAsSeen — no db or memberId yet");
    return;
  }
  console.log("[channel] markMessagesAsSeen — started");
  try {
    const receipts = await db.value.message_receipts
      .find({
        selector: {
          member_id: currentMemberId.value,
          status: "delivered",
        },
      })
      .exec();
    console.log(
      `[channel] markMessagesAsSeen — found ${receipts.length} delivered receipts to mark seen`,
    );
    for (const receipt of receipts) {
      await receipt.patch({
        status: "seen",
        updated_at: new Date().toISOString(),
      });
    }
    console.log(`[channel] markMessagesAsSeen — marked ${receipts.length} as seen`);
  } catch (e) {
    console.warn("[channel] markMessagesAsSeen — error:", e);
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
  if (!db.value) {
    console.warn("[channel] onSend — no db");
    return;
  }
  if (!currentMemberId.value) {
    console.warn("[channel] onSend — no currentMemberId yet");
    return;
  }

  // If in edit mode, patch existing message instead of inserting
  if (editingMessageId.value) {
    console.log("[channel] onSend — edit mode, patching", editingMessageId.value);
    const doc = await db.value.messages.findOne(editingMessageId.value).exec();
    if (doc) {
      await doc.patch({
        content,
        edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      console.log("[channel] onSend — edit patch done");
    }
    editingMessageId.value = null;
    editingContent.value = "";
    return;
  }

  const id = generateId();
  console.log("[channel] onSend — inserting msg locally", { id, content });
  const now = new Date().toISOString();
  pendingSendIds.value = new Set(pendingSendIds.value).add(id);
  console.log(
    "[channel] onSend — pending IDs now:",
    [...pendingSendIds.value].map((s) => s.slice(0, 8)),
  );
  await db.value.messages.insert({
    id,
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
  console.log("[channel] onSend — insert done");
  buildMessageStatuses();
}

async function onDelete(messageId: string) {
  if (!db.value) return;
  const doc = await db.value.messages.findOne(messageId).exec();
  if (!doc) return;
  await doc.incrementalModify((data: any) => {
    data.deleted_at = new Date().toISOString();
    data.updated_at = data.deleted_at;
    return data;
  });
}

async function onEditMessageFromBubble(messageId: string, content: string) {
  console.log("[channel] onEditMessageFromBubble — loading into composer", { messageId, content });
  editingMessageId.value = messageId;
  editingContent.value = content;
}

function cancelEdit() {
  console.log("[channel] cancelEdit");
  editingMessageId.value = null;
  editingContent.value = "";
}

async function onLoadOlder() {
  console.log(
    "[channel] onLoadOlder — hasMore:",
    hasMore.value,
    "hasMoreHistory:",
    hasMoreHistory.value,
  );
  if (hasMore.value) {
    await loadOlder();
  } else if (hasMoreHistory.value && oldestTimestamp.value && db.value) {
    console.log("[channel] onLoadOlder — fetching from history API");
    await loadHistoryFromServer(oldestTimestamp.value, db.value);
  } else {
    console.log("[channel] onLoadOlder — nothing more to load");
  }
}

// Rebuild statuses whenever messages, pending IDs, or member ID change
watch(
  [messages, pendingSendIds, currentMemberId],
  () => {
    buildMessageStatuses();
  },
  { deep: true },
);

async function onToggleReaction(messageId: string, emoji: string) {
  if (!db.value) return;
  const doc = await db.value.messages.findOne(messageId).exec();
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
  console.log("[channel] onToggleReaction:", { messageId, emoji });
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
        :loading-more="loadingMore"
        :error="hasError"
        :message-statuses="messageStatuses"
        :members="membersMap"
        @toggle-reaction="onToggleReaction"
        @open-thread="onOpenThread"
        @start-edit="onEditMessageFromBubble"
        @delete="onDelete"
        @load-older="onLoadOlder"
      />
      <ChannelComposer
        :editing-message-id="editingMessageId"
        :editing-content="editingContent"
        @send="onSend"
        @cancel-edit="cancelEdit"
      />
    </NuxtLayout>
  </NuxtLayout>
</template>
