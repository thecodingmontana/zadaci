import type { RxCollection } from "rxdb";
import type { Ref } from "vue";
import type { MessageDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
import type { ChatMessage, MessageReaction } from "~/types/chat";

const PAGE_SIZE = 50;
const QUERY_RETRIES = 3;

async function queryWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < QUERY_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isDocsDataError =
        err?.message?.includes("docsData") ||
        err?.message?.includes("read-only and non-configurable");
      if (isDocsDataError && attempt < QUERY_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("queryWithRetry: all retries exhausted");
}

export function useMessageWindow(
  collectionRef: Ref<RxCollection<MessageDocType> | null>,
  channelId: string,
) {
  const messages = ref<ChatMessage[]>([]);
  const loading = ref(true);
  const hasMore = ref(true);
  const hasMoreHistory = ref(true);
  const loadingMore = ref(false);
  const loadingHistory = ref(false);
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

  function insertMessageInOrder(msg: ChatMessage) {
    const idx = messages.value.findIndex((m) => m.createdAt > msg.createdAt);
    if (idx === -1) {
      messages.value = [...messages.value, msg];
    } else {
      messages.value = [...messages.value.slice(0, idx), msg, ...messages.value.slice(idx)];
    }
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

      const docs = await queryWithRetry(() =>
        col
          .find({
            selector: { channel_id: channelId, deleted_at: null, parent_message_id: null },
            sort: [{ created_at: "desc" }],
            limit: PAGE_SIZE,
          })
          .exec(),
      );

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
    if (!col || loadingMore.value || !oldestTimestamp.value) return;

    loadingMore.value = true;
    try {
      const before = oldestTimestamp.value;
      const docs = await queryWithRetry(() =>
        col
          .find({
            selector: {
              channel_id: channelId,
              deleted_at: null,
              parent_message_id: null,
              created_at: { $lt: before },
            },
            sort: [{ created_at: "desc" }],
            limit: PAGE_SIZE,
          })
          .exec(),
      );

      const loaded = docs.map(docToMessage).reverse();

      if (loaded.length > 0) {
        messages.value = [...loaded, ...messages.value];
        oldestTimestamp.value = loaded[0].createdAt;
      } else {
        hasMore.value = false;
        return;
      }
      hasMore.value = loaded.length === PAGE_SIZE;
    } finally {
      loadingMore.value = false;
    }
  }

  async function loadHistoryFromServer(before: string, db: ZadaciDatabase) {
    if (!before || loadingHistory.value || !hasMoreHistory.value) return;
    loadingHistory.value = true;
    try {
      const data: any = await $fetch(`/api/channels/${channelId}/messages/history`, {
        query: { before, limit: PAGE_SIZE },
      });
      if (data.messages?.length) {
        await db.messages.bulkUpsert(data.messages);
      }
      hasMoreHistory.value = data.nextCursor != null;
      return data.nextCursor as string | null;
    } catch (err) {
      console.error("[useMessageWindow] loadHistoryFromServer — FETCH ERROR:", err);
      return null;
    } finally {
      loadingHistory.value = false;
    }
  }

  let subs: { unsubscribe: () => void }[] = [];

  function subscribe() {
    const col = getCollection();
    if (!col) return;

    const eventSub = col.eventBulks$.subscribe((bulk: any) => {
      if (!bulk?.events?.length) return;
      for (const event of bulk.events) {
        if (event.operation === "INSERT") {
          const doc = event.data;
          if (!doc || doc.channel_id !== channelId || doc.deleted_at || doc.parent_message_id)
            continue;
          if (messages.value.some((m) => m.id === doc.id)) continue;
          insertMessageInOrder(docToMessage(doc));
        } else if (event.operation === "UPDATE") {
          const idx = messages.value.findIndex((m) => m.id === event.documentId);
          if (idx === -1) continue;
          const doc = event.data;
          if (!doc) continue;
          if (doc.deleted_at) {
            messages.value = messages.value.filter((m) => m.id !== event.documentId);
          } else {
            messages.value[idx] = docToMessage(doc);
          }
        } else if (event.operation === "DELETE") {
          messages.value = messages.value.filter((m) => m.id !== event.documentId);
        }
      }
    });

    subs = [{ unsubscribe: () => eventSub.unsubscribe() }];
  }

  function unsubscribe() {
    for (const s of subs) {
      s.unsubscribe();
    }
    subs = [];
  }

  return {
    messages,
    loading,
    hasMore,
    hasMoreHistory,
    loadingMore,
    loadingHistory,
    oldestTimestamp,
    loadInitial,
    loadOlder,
    loadHistoryFromServer,
    subscribe,
    unsubscribe,
    docToMessage,
  };
}
