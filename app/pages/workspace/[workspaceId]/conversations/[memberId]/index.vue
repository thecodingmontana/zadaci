<script setup lang="ts">
import type { RxCollection } from "rxdb";
import type { MessageDocType, MessageReceiptDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
import type { TeammatesWithProfile } from "~/types";
import type { ChatMessage, MessageReaction, Thread } from "~/types/chat";
import { AnimatePresence, motion } from "motion-v";
import ConversationHeader from "~/components/workspace/communication/conversation/conversation-header.vue";
import ChannelComposer from "~/components/workspace/communication/shared/channel-composer.vue";
import ChannelMessages from "~/components/workspace/communication/shared/channel-messages.vue";
import ThreadPanel from "~/components/workspace/communication/shared/thread-panel.vue";
import { queryWithRetry } from "~/utils/rxdb-helpers";

definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const route = useRoute();
const workspaceId = route.params.workspaceId as string;
const targetUserId = route.params.memberId as string;

interface MemberInfo {
  name: string;
  avatar: string | null;
}

const { user: authUser } = useUserSession();
const workspaceIdRef = computed(() => workspaceId);
const { data: members } = useWorkspaceMembers(workspaceIdRef);

const presence = useWorkspacePresence(() => workspaceId);
const { data: userStatuses } = useUserStatuses(workspaceIdRef);

const currentMemberId = ref<string>("");
const targetMember = ref<TeammatesWithProfile | null>(null);
const channelId = ref<string>("");
const channelResolved = ref(false);

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

// Inline message window — useMessageWindow takes a static channelId,
// but DM channelId is resolved asynchronously.
const messages = ref<ChatMessage[]>([]);
const loading = ref(true);
const hasMore = ref(true);
const hasMoreHistory = ref(true);
const loadingMore = ref(false);
const oldestTimestamp = ref<string | null>(null);
let messageSubs: { unsubscribe: () => void }[] = [];

function docToMessage(doc: MessageDocType): ChatMessage {
  return {
    id: doc.id,
    channelId: doc.channel_id,
    authorId: doc.author_id,
    content: doc.content,
    createdAt: doc.created_at,
    editedAt: doc.edited_at,
    reactions: (doc.reactions ?? []) as MessageReaction[],
    parentMessageId: doc.parent_message_id,
    threadReplyCount: doc.thread_reply_count ?? 0,
    threadParticipantIds: doc.thread_participant_ids ?? [],
    threadLastReplyAt: doc.thread_last_reply_at,
    deletedAt: doc.deleted_at,
  };
}

async function loadInitialMessages() {
  loading.value = true;
  try {
    const col = messageCollection.value;
    if (!col) {
      messages.value = [];
      hasMore.value = false;
      return;
    }
    const docs = await queryWithRetry(() =>
      col
        .find({
          selector: { channel_id: channelId.value, deleted_at: null, parent_message_id: null },
          sort: [{ created_at: "desc" }],
          limit: 50,
        })
        .exec(),
    );
    const loaded = docs.map(docToMessage).reverse();
    messages.value = loaded;
    if (loaded.length > 0) oldestTimestamp.value = loaded[0]!.createdAt;
    hasMore.value = loaded.length === 50;
  } finally {
    loading.value = false;
  }
}

async function loadOlderMessages() {
  const col = messageCollection.value;
  if (!col || loadingMore.value || !oldestTimestamp.value) return;
  loadingMore.value = true;
  try {
    const before = oldestTimestamp.value;
    const docs = await queryWithRetry(() =>
      col
        .find({
          selector: {
            channel_id: channelId.value,
            deleted_at: null,
            parent_message_id: null,
            created_at: { $lt: before },
          },
          sort: [{ created_at: "desc" }],
          limit: 50,
        })
        .exec(),
    );
    const loaded = docs.map(docToMessage).reverse();
    if (loaded.length > 0) {
      messages.value = [...loaded, ...messages.value];
      oldestTimestamp.value = loaded[0]!.createdAt;
    } else {
      hasMore.value = false;
      return;
    }
    hasMore.value = loaded.length === 50;
  } finally {
    loadingMore.value = false;
  }
}

async function loadHistoryFromServer(before: string) {
  if (!before || !db.value) return;
  try {
    const data: any = await $fetch(`/api/channels/${channelId.value}/messages/history`, {
      query: { before, limit: 50 },
    });
    if (data.messages?.length) {
      await db.value.messages.bulkUpsert(data.messages);
    }
    hasMoreHistory.value = data.nextCursor != null;
  } catch {
    // ignore
  }
}

function subscribeMessages() {
  const col = messageCollection.value;
  if (!col) return;
  const querySub = col
    .find({
      selector: { channel_id: channelId.value, deleted_at: null, parent_message_id: null },
      sort: [{ created_at: "desc" }],
    })
    .$.subscribe((docs) => {
      const loaded = docs.map(docToMessage).reverse();
      messages.value = loaded;
      if (loaded.length > 0) oldestTimestamp.value = loaded[0]!.createdAt;
      hasMore.value = loaded.length >= 50;
    });
  messageSubs = [{ unsubscribe: () => querySub.unsubscribe() }];
}

function unsubscribeMessages() {
  for (const s of messageSubs) s.unsubscribe();
  messageSubs = [];
}

const editingMessageId = ref<string | null>(null);
const editingContent = ref("");

const hasLoaded = ref(false);
const hasError = ref(false);
const systemEvents = ref<any[]>([]);

const messageSync = useMessageSync(() => channelId.value, {
  add: addPending,
  remove: removePending,
});
const receiptSync = useMessageReceiptSync(() => channelId.value);

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

const channelSubRef = ref<{ unsubscribe: () => void } | null>(null);

onUnmounted(() => {
  channelSubRef.value?.unsubscribe();
  unsubscribeMessages();
  messageSync.stop();
  receiptSync.stop();
});

const receiptSub = ref<{ unsubscribe: () => void } | null>(null);

const messageStatuses = ref<Map<string, "sending" | "sent" | "delivered" | "seen">>(new Map());
let lastReceiptQuery = 0;

function buildMessageStatuses() {
  const statuses = new Map<string, "sending" | "sent" | "delivered" | "seen">();
  const col = receiptCollection.value;
  const ownMsgs = messages.value.filter((m) => m.authorId === currentMemberId.value);
  for (const msg of ownMsgs) {
    if (pendingSendIds.value.has(msg.id)) {
      statuses.set(msg.id, "sending");
      continue;
    }
    statuses.set(msg.id, "sent");
  }
  messageStatuses.value = statuses;

  if (col && lastReceiptQuery > 0) {
    queryWithRetry(() => col.find({ selector: {} }).exec()).then((receiptDocs) => {
      const updated = new Map(messageStatuses.value);
      for (const msg of ownMsgs) {
        const msgReceipts = receiptDocs.filter(
          (r) => r.message_id === msg.id && r.member_id !== currentMemberId.value,
        );
        if (msgReceipts.length === 0) continue;
        const hasSeen = msgReceipts.some((r) => r.status === "seen");
        const hasDelivered = msgReceipts.some((r) => r.status === "delivered");
        if (hasSeen) {
          updated.set(msg.id, "seen");
        } else if (hasDelivered) {
          updated.set(msg.id, "delivered");
        }
      }
      messageStatuses.value = updated;
    });
  }
}

function subscribeReceipts() {
  const col = receiptCollection.value;
  if (!col) return;
  receiptSub.value?.unsubscribe();
  receiptSub.value = col
    .find({
      selector: {},
      sort: [{ updated_at: "desc" }],
      limit: 200,
    })
    .$.subscribe(async (docs) => {
      if (currentMemberId.value) {
        const myNewDelivered = docs.filter(
          (r) => r.member_id === currentMemberId.value && r.status === "delivered",
        );
        if (myNewDelivered.length > 0) {
          for (const r of myNewDelivered) {
            try {
              await r.incrementalModify((d: any) => {
                d.status = "seen";
                d.updated_at = new Date().toISOString();
                return d;
              });
            } catch {
              // ignore
            }
          }
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

async function findOrCreateDmChannel(): Promise<string> {
  try {
    const data: any = await $fetch("/api/channels/dm", {
      query: {
        workspace_id: workspaceId,
        targetUserId,
      },
    });
    return data.channelId as string;
  } catch (err: any) {
    console.error("[dm] findOrCreateDmChannel failed:", err?.message ?? err);
    throw err;
  }
}

async function init() {
  hasError.value = false;
  try {
    const rxdb = await useRxDbSafe();
    if (!rxdb) {
      hasError.value = true;
      return;
    }
    db.value = rxdb;

    // Find or create DM channel
    const dmChannelId = await findOrCreateDmChannel();
    channelId.value = dmChannelId;
    channelResolved.value = true;

    // Insert channel into RxDB if not already there (sync will pick it up too)
    const existingChannel = await queryWithRetry(() => rxdb.channels.findOne(dmChannelId).exec());
    if (!existingChannel) {
      const ts = new Date().toISOString();
      try {
        await rxdb.channels.insert({
          id: dmChannelId,
          workspace_id: workspaceId,
          name: null,
          type: "dm",
          created_by: authUser.value?.id ?? "",
          created_at: ts,
          updated_at: ts,
          deleted_at: null,
        });
      } catch {
        // Ignore duplicate insert errors
      }
    }

    messageCollection.value = rxdb.messages;
    receiptCollection.value = rxdb.message_receipts;

    // Start syncs
    try {
      await messageSync.start();
    } catch (e) {
      console.error("[dm] messageSync.start() threw:", e);
      hasError.value = true;
    }

    try {
      await receiptSync.start();
    } catch (e) {
      console.error("[dm] receiptSync.start() threw:", e);
    }

    subscribeReceipts();
    await loadInitialMessages();
    subscribeMessages();
    hasLoaded.value = true;

    markMessagesAsSeen();
  } catch (e) {
    console.error("[dm] init() threw:", e);
    hasError.value = true;
  }
}

async function markMessagesAsSeen() {
  if (!db.value || !currentMemberId.value) return;
  try {
    const receipts = await queryWithRetry(() =>
      db
        .value!.message_receipts.find({
          selector: {
            member_id: currentMemberId.value,
            status: "delivered",
          },
        })
        .exec(),
    );
    for (const receipt of receipts) {
      await receipt.patch({
        status: "seen",
        updated_at: new Date().toISOString(),
      });
    }
  } catch {
    // ignore
  }
}

// Resolve current member ID and target member once workspace members load
watch(
  () => members.value,
  (val) => {
    if (!val || !authUser.value?.id) return;
    const me = val.find((m: any) => m.userId === authUser.value!.id);
    if (me) currentMemberId.value = me.id;
    const other = val.find((m: any) => m.userId === targetUserId);
    if (other) targetMember.value = other;
  },
  { immediate: true },
);

// Wait for members and currentMemberId before starting init
watch(
  [() => members.value, currentMemberId],
  async ([m, memberId]) => {
    if (!m || memberId === "me" || !memberId) return;
    if (!channelResolved.value && !hasError.value) {
      presence.start();
      await init();
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
}

async function onSend(content: string) {
  if (!db.value) return;
  if (!currentMemberId.value) return;

  if (editingMessageId.value) {
    const doc = await queryWithRetry(() =>
      db.value!.messages.findOne(editingMessageId.value!).exec(),
    );
    if (doc) {
      await doc.patch({
        content,
        edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    editingMessageId.value = null;
    editingContent.value = "";
    return;
  }

  const id = generateId();
  const now = new Date().toISOString();
  pendingSendIds.value = new Set(pendingSendIds.value).add(id);
  await db.value.messages.insert({
    id,
    channel_id: channelId.value,
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
  buildMessageStatuses();

  try {
    const pushBody = [
      {
        assumedMasterState: null,
        newDocumentState: {
          id,
          channel_id: channelId.value,
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
        },
      },
    ];
    await $fetch(`/api/replication/messages/push?channel_id=${channelId.value}`, {
      method: "POST",
      body: pushBody,
    });
  } catch (err: any) {
    console.warn("[dm] onSend — push to server failed:", err?.message ?? err);
  } finally {
    removePending(id);
    buildMessageStatuses();
  }
}

async function onDelete(messageId: string) {
  if (!db.value) return;
  const doc = await queryWithRetry(() => db.value!.messages.findOne(messageId).exec());
  if (!doc) return;
  await doc.incrementalModify((data: any) => {
    data.deleted_at = new Date().toISOString();
    data.updated_at = data.deleted_at;
    return data;
  });
}

async function onEditMessageFromBubble(messageId: string, content: string) {
  editingMessageId.value = messageId;
  editingContent.value = content;
}

function cancelEdit() {
  editingMessageId.value = null;
  editingContent.value = "";
}

async function onLoadOlder() {
  if (hasMore.value) {
    await loadOlderMessages();
  } else if (hasMoreHistory.value && oldestTimestamp.value) {
    await loadHistoryFromServer(oldestTimestamp.value);
    await loadOlderMessages();
  }
}

watch(
  [messages, pendingSendIds, currentMemberId],
  () => {
    buildMessageStatuses();
  },
  { deep: true },
);

async function onToggleReaction(messageId: string, emoji: string) {
  if (!db.value) return;
  const doc = await queryWithRetry(() => db.value!.messages.findOne(messageId).exec());
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

// Thread panel state
const activeThread = ref<Thread | null>(null);

function closeThread() {
  activeThread.value = null;
}

async function onOpenThread(messageId: string) {
  if (!db.value) return;

  const parent = await queryWithRetry(() => db.value!.messages.findOne(messageId).exec());
  if (!parent) return;

  const replies = await queryWithRetry(() =>
    db
      .value!.messages.find({
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
  activeThread.value = thread;
}

async function onReply(parentMessageId: string, content: string) {
  if (!currentMemberId.value || !db.value) return;

  const now = new Date().toISOString();

  await db.value.messages.insert({
    id: generateId(),
    channel_id: channelId.value,
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

  const parent = await queryWithRetry(() => db.value!.messages.findOne(parentMessageId).exec());
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
          id: generateId(),
          channel_id: channelId.value,
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
    await $fetch(`/api/replication/messages/push?channel_id=${channelId.value}`, {
      method: "POST",
      body: pushBody,
    });
  } catch {
    // ignore
  }
}

async function onOpenThreadFromThread(messageId: string) {
  const rxdb = await useRxDbSafe();
  if (!rxdb) return;
  const parent = await queryWithRetry(() => rxdb.messages.findOne(messageId).exec());
  if (!parent) return;
  const replies = await queryWithRetry(() =>
    rxdb.messages
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
  activeThread.value = thread;
}

async function onDeleteMessage(messageId: string) {
  if (!db.value) return;
  const doc = await queryWithRetry(() => db.value!.messages.findOne(messageId).exec());
  if (!doc) return;

  const parentMessageId = doc.parent_message_id;

  await doc.incrementalModify((data: any) => {
    data.deleted_at = new Date().toISOString();
    data.updated_at = data.deleted_at;
    return data;
  });

  if (parentMessageId) {
    const parent = await queryWithRetry(() => db.value!.messages.findOne(parentMessageId).exec());
    if (parent) {
      await parent.incrementalModify((data: any) => {
        data.thread_reply_count = Math.max(0, (data.thread_reply_count ?? 0) - 1);
        data.updated_at = new Date().toISOString();
        return data;
      });
    }
  }
}

// Compute the other member's status for the header
const memberStatus = computed(() => {
  if (!targetMember.value) return "offline";
  const online = presence.onlineUserIds.value;
  const statuses = userStatuses.value ?? [];
  const statusMap = new Map(statuses.map((s) => [s.userId, s.status]));
  if (online.has(targetMember.value.userId)) {
    const customStatus = statusMap.get(targetMember.value.userId);
    return customStatus && customStatus !== "offline" ? customStatus : "available";
  }
  return "offline";
});

// Channel name for empty state — use target member's username
const displayName = computed(() => targetMember.value?.user?.username ?? null);

const conversationTitle = useWorkspacePageTitle(
  "Conversation",
  computed(() => targetMember.value?.user?.username ?? null),
);
useSeoMeta({
  title: conversationTitle,
  description: "Direct messages — chat privately with your workspace members.",
});
</script>

<template>
  <NuxtLayout name="workspace">
    <div class="flex h-full min-h-0 overflow-hidden">
      <div class="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ConversationHeader :member="targetMember" :status="memberStatus" />
        <ChannelMessages
          :messages="messages"
          :system-events="systemEvents"
          :current-member-id="currentMemberId"
          :channel-name="displayName ?? undefined"
          :loading="loading"
          :has-loaded="hasLoaded"
          :loading-more="loadingMore"
          :has-more="hasMore"
          :has-more-history="hasMoreHistory"
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
          :placeholder="`Message @${displayName ?? 'user'}`"
          @send="onSend"
          @cancel-edit="cancelEdit"
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          v-if="activeThread"
          key="thread"
          :initial="{ width: 0, opacity: 0 }"
          :animate="{ width: 360, opacity: 1 }"
          :exit="{ width: 0, opacity: 0 }"
          :transition="{ duration: 0.2, ease: 'easeOut' }"
          class="h-full overflow-hidden"
        >
          <ThreadPanel
            :thread="activeThread"
            :current-member-id="currentMemberId"
            :members="membersMap"
            @close="closeThread"
            @reply="onReply"
            @toggle-reaction="onToggleReaction"
            @open-thread="onOpenThreadFromThread"
            @delete="onDeleteMessage"
          />
        </motion.div>
      </AnimatePresence>
    </div>
  </NuxtLayout>
</template>
