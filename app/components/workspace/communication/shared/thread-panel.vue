<script setup lang="ts">
import type { RxCollection } from "rxdb";
import type { MessageDocType, MessageReceiptDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
import type { ChatMessage, Thread } from "~/types/chat";
import { AnimatePresence, motion } from "motion-v";
import ChannelComposer from "~/components/workspace/communication/shared/channel-composer.vue";
import MessageCard from "~/components/workspace/communication/shared/message-card.vue";
import { queryWithRetry } from "~/utils/rxdb-helpers";

const props = defineProps<{
  thread: Thread;
  currentMemberId: string;
  members?: Map<string, MemberInfo>;
}>();

const emit = defineEmits<{
  close: [];
  reply: [parentMessageId: string, content: string];
  toggleReaction: [messageId: string, emoji: string];
  delete: [messageId: string];
  openThread: [messageId: string];
}>();

const PAGE_SIZE = 50;

interface MemberInfo {
  name: string;
  avatar: string | null;
}

const parentMessage = ref<ChatMessage>(props.thread.parentMessage);
const replies = ref<ChatMessage[]>([]);
const loading = ref(true);
const loadingMore = ref(false);
const hasMore = ref(false);
const editingMessageId = ref<string | null>(null);
const editingContent = ref("");
const messageStatuses = ref<Map<string, "sending" | "sent" | "delivered" | "seen">>(new Map());
let receiptSub: { unsubscribe: () => void } | null = null;

function docToMessage(doc: MessageDocType): ChatMessage {
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

const receiptCollection = ref<RxCollection<MessageReceiptDocType> | null>(null);

function buildMessageStatuses() {
  const statuses = new Map<string, "sending" | "sent" | "delivered" | "seen">();
  const col = receiptCollection.value;
  const ownMsgs = replies.value.filter((m) => m.authorId === props.currentMemberId);
  for (const msg of ownMsgs) {
    statuses.set(msg.id, "sent");
  }
  if (col && ownMsgs.length > 0) {
    const allReceipts = queryWithRetry(() => col.find({ selector: {} }).exec());
    allReceipts.then((receiptDocs) => {
      for (const msg of ownMsgs) {
        const msgReceipts = receiptDocs.filter(
          (r) => r.message_id === msg.id && r.member_id !== props.currentMemberId,
        );
        if (msgReceipts.length === 0) continue;
        const hasSeen = msgReceipts.some((r) => r.status === "seen");
        const hasDelivered = msgReceipts.some((r) => r.status === "delivered");
        if (hasSeen) {
          statuses.set(msg.id, "seen");
        } else if (hasDelivered) {
          statuses.set(msg.id, "delivered");
        }
      }
      messageStatuses.value = statuses;
    });
    return;
  }
  messageStatuses.value = statuses;
}

function subscribeReceipts(rxdb: ZadaciDatabase) {
  const col = rxdb.message_receipts;
  receiptCollection.value = col;
  receiptSub?.unsubscribe();
  receiptSub = col
    .find({
      selector: {},
      sort: [{ updated_at: "desc" }],
      limit: 200,
    })
    .$.subscribe(() => {
      buildMessageStatuses();
    });
}

let subs: { unsubscribe: () => void }[] = [];

async function loadInitialReplies(rxdb: ZadaciDatabase) {
  loading.value = true;
  try {
    const docs = await rxdb.messages
      .find({
        selector: { parent_message_id: props.thread.parentMessageId, deleted_at: null },
        sort: [{ created_at: "desc" }],
        limit: PAGE_SIZE,
      })
      .exec();
    const loaded = docs.map(docToMessage).reverse();
    replies.value = loaded;
    hasMore.value = loaded.length === PAGE_SIZE;
  } finally {
    loading.value = false;
  }
}

async function loadOlderReplies() {
  if (loadingMore.value || replies.value.length === 0) return;
  loadingMore.value = true;
  try {
    const rxdb = await useRxDbSafe();
    if (!rxdb) return;
    const oldest = replies.value[0].createdAt;
    const docs = await rxdb.messages
      .find({
        selector: {
          parent_message_id: props.thread.parentMessageId,
          deleted_at: null,
          created_at: { $lt: oldest },
        },
        sort: [{ created_at: "desc" }],
        limit: PAGE_SIZE,
      })
      .exec();
    const loaded = docs.map(docToMessage).reverse();
    if (loaded.length > 0) {
      replies.value = [...loaded, ...replies.value];
    }
    hasMore.value = loaded.length === PAGE_SIZE;
  } finally {
    loadingMore.value = false;
  }
}

async function init() {
  const rxdb = await useRxDbSafe();
  if (!rxdb) return;

  subscribeReceipts(rxdb);

  const parentSub = rxdb.messages.findOne(props.thread.parentMessageId).$.subscribe((doc) => {
    if (doc && !doc.deleted_at) {
      parentMessage.value = docToMessage(doc);
    } else {
      emit("close");
    }
  });
  subs.push(parentSub);

  await loadInitialReplies(rxdb);

  const repliesSub = rxdb.messages
    .find({
      selector: { parent_message_id: props.thread.parentMessageId, deleted_at: null },
      sort: [{ created_at: "asc" }],
    })
    .$.subscribe((docs) => {
      replies.value = docs.map(docToMessage);
      loading.value = false;
      buildMessageStatuses();
    });
  subs.push({ unsubscribe: () => repliesSub.unsubscribe() });

  buildMessageStatuses();
}

function cleanup() {
  subs.forEach((s) => s.unsubscribe());
  subs = [];
  receiptSub?.unsubscribe();
  receiptSub = null;
}

watch(
  () => props.thread,
  (newThread) => {
    cleanup();
    parentMessage.value = newThread.parentMessage;
    replies.value = [];
    loading.value = true;
    hasMore.value = false;
    init();
  },
);

onMounted(() => init());

onUnmounted(() => {
  cleanup();
});

function memberInfo(authorId: string): MemberInfo {
  return props.members?.get(authorId) ?? { name: authorId, avatar: null };
}

interface TimelineItem {
  message: ChatMessage;
  isParent: boolean;
}

const timelineItems = computed<TimelineItem[]>(() => [
  { message: parentMessage.value, isParent: true },
  ...replies.value.map((message) => ({ message, isParent: false })),
]);

function isOwnMessage(message: ChatMessage): boolean {
  return message.authorId === props.currentMemberId;
}

function onStartEditFromReply(messageId: string, content: string) {
  editingMessageId.value = messageId;
  editingContent.value = content;
}

function cancelEdit() {
  editingMessageId.value = null;
  editingContent.value = "";
}

async function onComposerSend(content: string) {
  if (editingMessageId.value) {
    const rxdb = await useRxDbSafe();
    if (!rxdb) return;
    const doc = await queryWithRetry(() => rxdb.messages.findOne(editingMessageId.value!).exec());
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
  emit("reply", props.thread.parentMessageId, content);
}
</script>

<template>
  <div class="flex h-full w-full flex-col border-l">
    <div class="flex items-center justify-between border-b px-4 py-4.5">
      <p class="text-base font-semibold">Thread</p>
      <Button variant="ghost" size="icon-xs" aria-label="Close thread" @click="emit('close')">
        <Icon name="lucide:x" size="18" />
      </Button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <div v-if="hasMore" class="mb-3 flex justify-center">
        <button
          type="button"
          class="rounded-full border px-4 py-1 text-xs text-muted-foreground hover:text-foreground"
          @click="loadOlderReplies"
        >
          Load earlier replies
        </button>
      </div>

      <AnimatePresence>
        <motion.div
          v-for="(item, index) in timelineItems"
          :key="item.message.id"
          :initial="{ opacity: 0, y: 8 }"
          :animate="{ opacity: 1, y: 0 }"
          :exit="{ opacity: 0, x: 120 }"
          :transition="{ type: 'tween', duration: 0.18, exit: { duration: 0.5 } }"
          :class="[
            index < timelineItems.length - 1 ? 'pb-5' : '',
            item.isParent ? '-mx-3 rounded-lg px-3 py-2' : '',
          ]"
        >
          <MessageCard
            :message="item.message"
            :is-own="isOwnMessage(item.message)"
            :current-member-id="currentMemberId"
            :members="members"
            :show-thread-entry="false"
            :hide-thread-reply="item.isParent ? false : true"
            :delivery-status="!item.isParent ? messageStatuses.get(item.message.id) : undefined"
            @toggle-reaction="(...a) => emit('toggleReaction', ...a)"
            @open-thread="(id) => emit('openThread', id)"
            @start-edit="onStartEditFromReply"
            @delete="
              (id) => {
                if (id === parentMessage.id) emit('close');
                emit('delete', id);
              }
            "
          />
        </motion.div>
      </AnimatePresence>

      <div v-if="loading" class="py-3 text-center text-xs text-muted-foreground">
        Loading replies...
      </div>
    </div>

    <ChannelComposer
      :editing-message-id="editingMessageId"
      :editing-content="editingContent"
      :replying-to="editingMessageId ? undefined : memberInfo(parentMessage.authorId).name"
      typing-label=""
      placeholder="Reply in thread"
      @send="onComposerSend"
      @cancel-edit="cancelEdit"
      @cancel-reply="emit('close')"
    />
  </div>
</template>
