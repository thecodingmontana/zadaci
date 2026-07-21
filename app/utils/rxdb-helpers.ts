const QUERY_RETRIES = 6;
const DOCSDATA_ERROR_CHECK = (err: any) =>
  err?.message?.includes("docsData") || err?.message?.includes("read-only and non-configurable");

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function queryWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < QUERY_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (DOCSDATA_ERROR_CHECK(err) && attempt < QUERY_RETRIES - 1) {
        await delay(150 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  throw new Error("queryWithRetry: all retries exhausted");
}

export function tryEventData(event: any, expectedFields: string[]): any | null {
  const doc = event?.data;
  if (!doc) return null;
  for (const field of expectedFields) {
    if (!(field in doc)) return null;
  }
  return doc;
}

export function docToMessage(doc: any): import("~/types/chat").ChatMessage {
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
