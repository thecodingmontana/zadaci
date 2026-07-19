import type { RxCollection } from "rxdb";
import type { Ref } from "vue";
import type { MessageDocType } from "~/plugins/rxdb.client";
import type { ChatMessage, MessageReaction } from "~/types/chat";

const PAGE_SIZE = 50;

export function useMessageWindow(
  collectionRef: Ref<RxCollection<MessageDocType> | null>,
  channelId: string,
) {
  const messages = ref<ChatMessage[]>([]);
  const loading = ref(true);
  const hasMore = ref(true);
  const loadingMore = ref(false);
  const oldestTimestamp = ref<string | null>(null);

  function getCollection() {
    return collectionRef.value;
  }

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

  async function loadInitial() {
    loading.value = true;
    try {
      const col = getCollection();
      if (!col) {
        messages.value = [];
        hasMore.value = false;
        return;
      }

      const docs = await col
        .find({
          selector: { channel_id: channelId, deleted_at: null },
          sort: [{ created_at: "desc" }],
          limit: PAGE_SIZE,
        })
        .exec();

      const loaded = docs.map(docToMessage).reverse();
      messages.value = loaded;

      if (loaded.length > 0) {
        oldestTimestamp.value = loaded[0].createdAt;
      }
      hasMore.value = loaded.length === PAGE_SIZE;
    } finally {
      loading.value = false;
    }
  }

  async function loadOlder() {
    const col = getCollection();
    if (!col || !hasMore.value || loadingMore.value || !oldestTimestamp.value) {
      return;
    }

    loadingMore.value = true;
    try {
      const docs = await col
        .find({
          selector: {
            channel_id: channelId,
            deleted_at: null,
            created_at: { $lt: oldestTimestamp.value },
          },
          sort: [{ created_at: "desc" }],
          limit: PAGE_SIZE,
        })
        .exec();

      const loaded = docs.map(docToMessage).reverse();
      messages.value = [...loaded, ...messages.value];

      if (loaded.length > 0) {
        oldestTimestamp.value = loaded[0].createdAt;
      }
      hasMore.value = loaded.length === PAGE_SIZE;
    } finally {
      loadingMore.value = false;
    }
  }

  let sub: (() => void) | null = null;

  function subscribe() {
    const col = getCollection();
    if (!col) return;
    sub = col
      .find({
        selector: { channel_id: channelId, deleted_at: null },
        sort: [{ created_at: "desc" }],
        limit: PAGE_SIZE,
      })
      .$.subscribe((docs) => {
        const loaded = docs.map(docToMessage).reverse();
        messages.value = loaded;
        if (loaded.length > 0) {
          oldestTimestamp.value = loaded[0].createdAt;
        }
        hasMore.value = loaded.length === PAGE_SIZE;
      });
  }

  function unsubscribe() {
    if (sub) {
      sub.unsubscribe();
      sub = null;
    }
  }

  return {
    messages,
    loading,
    hasMore,
    loadingMore,
    loadInitial,
    loadOlder,
    subscribe,
    unsubscribe,
    docToMessage,
  };
}
