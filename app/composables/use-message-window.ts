import type { RxCollection } from "rxdb";
import type { Ref } from "vue";
import type { MessageDocType, ZadaciDatabase } from "~/plugins/rxdb.client";
import type { ChatMessage, MessageReaction } from "~/types/chat";

const PAGE_SIZE = 50;
const SUBSCRIBE_LIMIT = 500;

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
          selector: { channel_id: channelId, deleted_at: null, parent_message_id: null },
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
      console.log(
        `[useMessageWindow] loadInitial — loaded ${loaded.length} messages, hasMore=${hasMore.value}, oldest=${oldestTimestamp.value}`,
      );
    } finally {
      loading.value = false;
    }
  }

  async function loadOlder() {
    const col = getCollection();
    console.log(
      `[useMessageWindow] loadOlder — CALLED, loadingMore=${loadingMore.value}, oldestTimestamp=${oldestTimestamp.value}, hasMore=${hasMore.value}, hasMoreHistory=${hasMoreHistory.value}`,
    );
    if (!col || loadingMore.value || !oldestTimestamp.value) {
      console.log(
        `[useMessageWindow] loadOlder — SKIP (col=${!!col}, loadingMore=${loadingMore.value}, oldest=${oldestTimestamp.value})`,
      );
      return;
    }

    loadingMore.value = true;
    try {
      const before = oldestTimestamp.value;
      const docs = await col
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
        .exec();

      const loaded = docs.map(docToMessage).reverse();
      console.log(
        `[useMessageWindow] loadOlder — RxDB returned ${loaded.length} docs before ${before}, msgs before=${messages.value.length}`,
      );

      if (loaded.length > 0) {
        messages.value = [...loaded, ...messages.value];
        oldestTimestamp.value = loaded[0].createdAt;
        console.log(
          `[useMessageWindow] loadOlder — new oldest=${oldestTimestamp.value}, total msgs now=${messages.value.length}`,
        );
      } else {
        console.log(
          `[useMessageWindow] loadOlder — NO MORE local docs, falling through to hasMoreHistory=${hasMoreHistory.value}`,
        );
      }
      hasMore.value = loaded.length === PAGE_SIZE;
    } finally {
      loadingMore.value = false;
    }
  }

  async function loadHistoryFromServer(before: string, db: ZadaciDatabase) {
    console.log(
      `[useMessageWindow] loadHistoryFromServer — CALLED before=${before}, loadingHistory=${loadingHistory.value}, hasMoreHistory=${hasMoreHistory.value}`,
    );
    if (!before || loadingHistory.value || !hasMoreHistory.value) {
      console.log(
        `[useMessageWindow] loadHistoryFromServer — SKIP (before=${before}, loadingHistory=${loadingHistory.value}, hasMoreHistory=${hasMoreHistory.value})`,
      );
      return;
    }
    loadingHistory.value = true;
    try {
      console.log(
        `[useMessageWindow] loadHistoryFromServer — fetching /api/channels/${channelId}/messages/history`,
      );
      const data: any = await $fetch(`/api/channels/${channelId}/messages/history`, {
        query: { before, limit: PAGE_SIZE },
      });
      console.log(
        `[useMessageWindow] loadHistoryFromServer — API returned ${data.messages?.length} messages, nextCursor=${data.nextCursor}`,
      );
      if (data.messages?.length) {
        await db.messages.bulkUpsert(data.messages);
        console.log(
          `[useMessageWindow] loadHistoryFromServer — upserted ${data.messages.length} history messages into RxDB, total msgs before upsert=${messages.value.length}`,
        );
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
    console.log(`[useMessageWindow] subscribe — SUBSCRIBE_LIMIT=${SUBSCRIBE_LIMIT}`);

    // Primary subscription — re-emits when docs enter/leave the result set
    const querySub = col
      .find({
        selector: { channel_id: channelId, deleted_at: null, parent_message_id: null },
        sort: [{ created_at: "desc" }],
        limit: SUBSCRIBE_LIMIT,
      })
      .$.subscribe((docs) => {
        console.log(`[useMessageWindow] query subscription fired — ${docs.length} docs`);
        const loaded = docs.map(docToMessage).reverse();
        messages.value = loaded;
        if (loaded.length > 0) {
          oldestTimestamp.value = loaded[0].createdAt;
        }
        hasMore.value = loaded.length >= PAGE_SIZE;
      });

    // Fallback — RxDB v17 query .$ may skip field-level updates
    // that don't change sort position. Listen to raw event stream
    // so thread-reply count, reactions, edits update in-place.
    const eventSub = col.eventBulks$.subscribe((bulk: any) => {
      for (const event of bulk.events ?? []) {
        if (event.operation === "UPDATE" && event.documentId) {
          const idx = messages.value.findIndex((m) => m.id === event.documentId);
          if (idx !== -1) {
            col
              .findOne(event.documentId)
              .exec()
              .then((doc: any) => {
                if (doc && doc.channel_id === channelId) {
                  const idx2 = messages.value.findIndex((m) => m.id === event.documentId);
                  if (idx2 !== -1) {
                    messages.value[idx2] = docToMessage(doc);
                  }
                }
              });
          }
        }
      }
    });

    subs = [
      { unsubscribe: () => querySub.unsubscribe() },
      { unsubscribe: () => eventSub.unsubscribe() },
    ];
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
