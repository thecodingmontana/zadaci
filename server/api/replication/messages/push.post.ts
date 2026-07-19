import { inArray } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface PushRow {
  assumedMasterState: {
    id: string;
    updated_at: string;
  } | null;
  newDocumentState: {
    id: string;
    channel_id: string;
    author_id: string;
    content: string;
    edited_at: string | null;
    reactions: { emoji: string; member_ids: string[] }[];
    parent_message_id: string | null;
    thread_reply_count: number;
    thread_participant_ids: string[];
    thread_last_reply_at: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
}

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const userId = session.user.id;

    const body = await readBody<PushRow[]>(event);
    if (!Array.isArray(body) || body.length === 0) {
      return [];
    }

    const query = getQuery(event);
    const channelId = query.channel_id as string | undefined;
    if (!channelId) {
      throw createError({ statusCode: 400, statusMessage: "channel_id is required" });
    }

    const channel = await db.query.channel.findFirst({
      where: { id: channelId },
      with: { workspace: true },
    });
    if (!channel) {
      throw createError({ statusCode: 404, statusMessage: "Channel not found" });
    }

    const membership = await db.query.workspace_members.findFirst({
      where: { user_id: userId, workspace_id: channel.workspace_id },
    });
    if (!membership) {
      throw createError({ statusCode: 403, statusMessage: "Access denied" });
    }

    const invalidRows = body.filter((row) => row.newDocumentState.channel_id !== channelId);
    if (invalidRows.length > 0) {
      throw createError({
        statusCode: 403,
        statusMessage: "Some rows reference a different channel",
      });
    }

    const messageIds = body.map((row) => row.newDocumentState.id);
    const existingMessages = await db
      .select({
        id: tables.message.id,
        updated_at: tables.message.updated_at,
      })
      .from(tables.message)
      .where(inArray(tables.message.id, messageIds));

    const existingMap = new Map(existingMessages.map((m) => [m.id, m]));
    const conflicts: any[] = [];

    for (const row of body) {
      const doc = row.newDocumentState;
      const existing = existingMap.get(doc.id);

      if (existing) {
        const assumedUpdatedAt = row.assumedMasterState?.updated_at;
        const currentUpdatedAt = existing.updated_at.toISOString();

        if (assumedUpdatedAt && assumedUpdatedAt !== currentUpdatedAt) {
          const fullExisting = await db.query.message.findFirst({
            where: { id: doc.id },
          });
          conflicts.push(fullExisting ?? doc);
          continue;
        }
      }

      const deletedAt = doc.deleted_at ? new Date(doc.deleted_at) : null;
      const editedAt = doc.edited_at ? new Date(doc.edited_at) : null;
      const threadLastReplyAt = doc.thread_last_reply_at
        ? new Date(doc.thread_last_reply_at)
        : null;

      await db
        .insert(tables.message)
        .values({
          id: doc.id,
          channel_id: doc.channel_id,
          author_id: doc.author_id,
          content: doc.content,
          edited_at: editedAt,
          reactions: doc.reactions,
          parent_message_id: doc.parent_message_id,
          thread_reply_count: doc.thread_reply_count,
          thread_participant_ids: doc.thread_participant_ids,
          thread_last_reply_at: threadLastReplyAt,
          created_at: new Date(doc.created_at),
          updated_at: new Date(doc.updated_at),
          deleted_at: deletedAt,
        })
        .onConflictDoUpdate({
          target: tables.message.id,
          set: {
            content: doc.content,
            edited_at: editedAt,
            reactions: doc.reactions,
            parent_message_id: doc.parent_message_id,
            thread_reply_count: doc.thread_reply_count,
            thread_participant_ids: doc.thread_participant_ids,
            thread_last_reply_at: threadLastReplyAt,
            updated_at: new Date(doc.updated_at),
            deleted_at: deletedAt,
          },
        });
    }

    return conflicts;
  } catch (error: any) {
    if (error?.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      statusMessage: `Push failed: ${error.message || "Unknown error"}`,
    });
  }
});
