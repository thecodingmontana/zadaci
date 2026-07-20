<script setup lang="ts">
import type { RxCollection } from "rxdb";
import type { MessageDocType, MessageReceiptDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
import type { ChatMessage, Thread } from "~/types/chat";
import ChannelComposer from "~/components/workspace/channels/channel-composer.vue";
import ChannelMessages from "~/components/workspace/channels/channel-messages.vue";
import MessageBubble from "~/components/workspace/channels/message-bubble.vue";

const props = defineProps<{
  thread: Thread;
  currentMemberId: string;
}>();
const emit = defineEmits<{
  close: [];
  reply: [parentMessageId: string, content: string];
  toggleReaction: [messageId: string, emoji: string];
  delete: [messageId: string];
  openThread: [messageId: string];
}>();

const parentMessage = ref<ChatMessage>(props.thread.parentMessage);
const replies = ref<ChatMessage[]>(props.thread.replies);
const loading = ref(true);
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
    const allReceipts = col.find({ selector: {} }).exec();
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

async function init() {
  const rxdb = await useRxDbSafe();
  if (!rxdb) return;

  subscribeReceipts(rxdb);

  const parentSub = rxdb.messages.findOne(props.thread.parentMessageId).$.subscribe((doc) => {
    if (doc) parentMessage.value = docToMessage(doc);
  });
  subs.push(parentSub);

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
  subs.push(repliesSub);
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
    replies.value = newThread.replies;
    loading.value = true;
    init();
  },
);

onMounted(() => init());

onUnmounted(() => {
  cleanup();
});

const isParentOwn = computed(() => parentMessage.value.authorId === props.currentMemberId);

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
    const doc = await rxdb.messages.findOne(editingMessageId.value).exec();
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
  <div class="flex h-full w-[360px] flex-col border-l">
    <div class="flex items-center gap-2 border-b px-4 py-3">
      <Button variant="ghost" size="icon-xs" aria-label="Back to channel" @click="emit('close')">
        <Icon name="lucide:chevron-left" size="16" />
      </Button>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold">Thread</p>
        <p class="truncate text-xs text-muted-foreground">Thread</p>
      </div>
      <Button variant="ghost" size="icon-xs" aria-label="Close thread" @click="emit('close')">
        <Icon name="lucide:x" size="16" />
      </Button>
    </div>

    <!-- Root message — pinned style, no actions -->
    <div class="border-b bg-muted/30 px-4 py-3">
      <MessageBubble
        :message="parentMessage"
        :is-own="isParentOwn"
        :current-member-id="currentMemberId"
        :show-thread-entry="false"
        :hide-actions="true"
      />
    </div>

    <!-- Replies -->
    <ChannelMessages
      :messages="replies"
      :show-thread-entry="false"
      :hide-empty-state="true"
      :current-member-id="currentMemberId"
      :loading="loading"
      :has-loaded="!loading"
      :message-statuses="messageStatuses"
      @toggle-reaction="(...a) => emit('toggleReaction', ...a)"
      @open-thread="(id) => emit('openThread', id)"
      @start-edit="onStartEditFromReply"
      @delete="(id) => emit('delete', id)"
    />

    <ChannelComposer
      :editing-message-id="editingMessageId"
      :editing-content="editingContent"
      typing-label=""
      placeholder="Reply in thread"
      @send="onComposerSend"
      @cancel-edit="cancelEdit"
    />
  </div>
</template>
