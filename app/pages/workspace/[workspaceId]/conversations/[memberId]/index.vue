<script setup lang="ts">
import type { RxCollection } from "rxdb";
import type {
  DirectMessageDocType,
  DirectMessageReceiptDocType,
  ZadaciDatabase,
} from "~/plugins/rxdb.client";
import type { TeammatesWithProfile } from "~/types";
import type { ChatMessage, MessageReaction } from "~/types/chat";
import ConversationHeader from "~/components/workspace/communication/conversation/conversation-header.vue";
import ChannelComposer from "~/components/workspace/communication/shared/channel-composer.vue";
import ChannelMessages from "~/components/workspace/communication/shared/channel-messages.vue";
import { queryWithRetry } from "~/utils/rxdb-helpers";

definePageMeta({
  middleware: ["authenticated"],
  layout: false,
});

const route = useRoute();
const workspaceId = route.params.workspaceId as string;
const targetUserId = route.params.memberId as string;

const { user: authUser } = useUserSession();

const isSelfChat = computed(() => authUser.value?.id === targetUserId);

interface MemberInfo {
  name: string;
  avatar: string | null;
}
const workspaceIdRef = computed(() => workspaceId);
const { data: members } = useWorkspaceMembers(workspaceIdRef);

const presence = useWorkspacePresence(() => workspaceId);
const { data: userStatuses } = useUserStatuses(workspaceIdRef);

const currentMemberId = ref<string>("");
const targetMember = ref<TeammatesWithProfile | null>(null);
const conversationId = ref<string>("");
const conversationResolved = ref(false);

const db = ref<ZadaciDatabase | null>(null);
const directMessageCollection = ref<RxCollection<DirectMessageDocType> | null>(null);
const receiptCollection = ref<RxCollection<DirectMessageReceiptDocType> | null>(null);

const pendingSendIds = ref(new Set<string>());

function addPending(id: string) {
  pendingSendIds.value = new Set(pendingSendIds.value).add(id);
}
function removePending(id: string) {
  const next = new Set(pendingSendIds.value);
  next.delete(id);
  pendingSendIds.value = next;
}

const messages = ref<ChatMessage[]>([]);
const loading = ref(true);
const hasMore = ref(true);
const hasMoreHistory = ref(true);
const loadingMore = ref(false);
const oldestTimestamp = ref<string | null>(null);
let messageSubs: { unsubscribe: () => void }[] = [];

function docToMessage(doc: DirectMessageDocType): ChatMessage {
  return {
    id: doc.id,
    channelId: doc.conversation_id,
    authorId: doc.author_id,
    content: doc.content,
    createdAt: doc.created_at,
    editedAt: doc.edited_at,
    reactions: (doc.reactions ?? []) as MessageReaction[],
    parentMessageId: null,
    threadReplyCount: 0,
    threadParticipantIds: [],
    threadLastReplyAt: null,
    deletedAt: doc.deleted_at,
  };
}

async function loadInitialMessages() {
  loading.value = true;
  try {
    const col = directMessageCollection.value;
    if (!col) {
      messages.value = [];
      hasMore.value = false;
      return;
    }
    const docs = await queryWithRetry(() =>
      col
        .find({
          selector: { conversation_id: conversationId.value, deleted_at: null },
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
  const col = directMessageCollection.value;
  if (!col || loadingMore.value || !oldestTimestamp.value) return;
  loadingMore.value = true;
  try {
    const before = oldestTimestamp.value;
    const docs = await queryWithRetry(() =>
      col
        .find({
          selector: {
            conversation_id: conversationId.value,
            deleted_at: null,
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

function subscribeMessages() {
  const col = directMessageCollection.value;
  if (!col) return;
  const querySub = col
    .find({
      selector: { conversation_id: conversationId.value, deleted_at: null },
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

const dmSync = useDirectMessageSync(() => conversationId.value, {
  add: addPending,
  remove: removePending,
});
const dmReceiptSync = useDirectMessageReceiptSync(() => conversationId.value);

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

onUnmounted(() => {
  unsubscribeMessages();
  dmSync.stop();
  dmReceiptSync.stop();
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
          (r) => r.direct_message_id === msg.id && r.member_id !== currentMemberId.value,
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

async function findOrCreateDmConversation(): Promise<string> {
  try {
    const data: any = await $fetch("/api/conversations/dm", {
      query: {
        workspace_id: workspaceId,
        targetUserId,
      },
    });
    return data.conversationId as string;
  } catch (err: any) {
    console.error("[dm] findOrCreateDmConversation failed:", err?.message ?? err);
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

    const dmConversationId = await findOrCreateDmConversation();
    conversationId.value = dmConversationId;
    conversationResolved.value = true;

    directMessageCollection.value = rxdb.direct_messages;
    receiptCollection.value = rxdb.direct_message_receipts;

    try {
      await dmSync.start();
    } catch (e) {
      console.error("[dm] dmSync.start() threw:", e);
      hasError.value = true;
    }

    try {
      await dmReceiptSync.start();
    } catch (e) {
      console.error("[dm] dmReceiptSync.start() threw:", e);
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
        .value!.direct_message_receipts.find({
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

watch(
  [() => members.value, currentMemberId],
  async ([m, memberId]) => {
    if (!m || memberId === "me" || !memberId) return;
    if (!conversationResolved.value && !hasError.value) {
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
      db.value!.direct_messages.findOne(editingMessageId.value!).exec(),
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
  await db.value.direct_messages.insert({
    id,
    conversation_id: conversationId.value,
    author_id: currentMemberId.value,
    content,
    edited_at: null,
    reactions: [],
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  buildMessageStatuses();

  try {
    await $fetch(`/api/replication/direct-messages/push?conversation_id=${conversationId.value}`, {
      method: "POST",
      body: [
        {
          assumedMasterState: null,
          newDocumentState: {
            id,
            conversation_id: conversationId.value,
            author_id: currentMemberId.value,
            content,
            edited_at: null,
            reactions: [],
            created_at: now,
            updated_at: now,
            deleted_at: null,
          },
        },
      ],
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
  const doc = await queryWithRetry(() => db.value!.direct_messages.findOne(messageId).exec());
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
    hasMoreHistory.value = false;
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
  const doc = await queryWithRetry(() => db.value!.direct_messages.findOne(messageId).exec());
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
        <ConversationHeader
          :member="targetMember"
          :status="memberStatus"
          :is-self-chat="isSelfChat"
        />
        <ChannelMessages
          :messages="messages"
          :current-member-id="currentMemberId"
          :channel-name="displayName ?? undefined"
          :loading="loading"
          :has-loaded="hasLoaded"
          :loading-more="loadingMore"
          :has-more="hasMore"
          :error="hasError"
          :message-statuses="messageStatuses"
          :members="membersMap"
          :hide-thread-reply="true"
          empty-state-type="conversation"
          :empty-state-avatar-url="targetMember?.user?.profilePictureUrl ?? null"
          :is-self-chat="isSelfChat"
          @toggle-reaction="onToggleReaction"
          @start-edit="onEditMessageFromBubble"
          @delete="onDelete"
          @load-older="onLoadOlder"
        />
        <ChannelComposer
          :editing-message-id="editingMessageId"
          :editing-content="editingContent"
          :placeholder="isSelfChat ? 'Message yourself' : `Message @${displayName ?? 'user'}`"
          @send="onSend"
          @cancel-edit="cancelEdit"
        />
      </div>
    </div>
  </NuxtLayout>
</template>
