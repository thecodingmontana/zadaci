import { inArray } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface PushRow {
  assumedMasterState: { id: string; updated_at: string } | null;
  newDocumentState: {
    id: string;
    conversation_id: string;
    author_id: string;
    content: string;
    edited_at: string | null;
    reactions: { emoji: string; member_ids: string[] }[];
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
    if (!Array.isArray(body) || body.length === 0) return [];

    const query = getQuery(event);
    const conversationId = query.conversation_id as string | undefined;
    if (!conversationId) {
      throw createError({ statusCode: 400, statusMessage: "conversation_id is required" });
    }

    const conversation = await db.query.conversation.findFirst({ where: { id: conversationId } });
    if (!conversation) {
      throw createError({ statusCode: 404, statusMessage: "Conversation not found" });
    }

    const membership = await db.query.workspace_members.findFirst({
      where: { user_id: userId, workspace_id: conversation.workspace_id },
    });
    if (!membership) {
      throw createError({ statusCode: 403, statusMessage: "Access denied" });
    }

    if (
      membership.id !== conversation.member_one_id &&
      membership.id !== conversation.member_two_id
    ) {
      throw createError({ statusCode: 403, statusMessage: "Not a conversation participant" });
    }

    const invalidRows = body.filter(
      (row) => row.newDocumentState.conversation_id !== conversationId,
    );
    if (invalidRows.length > 0) {
      throw createError({
        statusCode: 403,
        statusMessage: "Some rows reference a different conversation",
      });
    }

    const messageIds = body.map((row) => row.newDocumentState.id);
    const existingMessages = await db
      .select({ id: tables.direct_message.id, updated_at: tables.direct_message.updated_at })
      .from(tables.direct_message)
      .where(inArray(tables.direct_message.id, messageIds));
    const existingIds = new Set(existingMessages.map((m) => m.id));

    const newRows = body.filter((row) => !existingIds.has(row.newDocumentState.id));
    const invalidAuthor = newRows.filter((row) => row.newDocumentState.author_id !== membership.id);
    if (invalidAuthor.length > 0) {
      throw createError({
        statusCode: 403,
        statusMessage: "Cannot send messages as another member",
      });
    }

    const existingMap = new Map(existingMessages.map((m) => [m.id, m]));
    const conflicts: any[] = [];

    for (const row of body) {
      const doc = row.newDocumentState;
      const existing = existingMap.get(doc.id);

      if (existing) {
        const assumedUpdatedAt = row.assumedMasterState?.updated_at;
        const currentUpdatedAt = existing.updated_at.toISOString();
        if (assumedUpdatedAt && assumedUpdatedAt !== currentUpdatedAt) {
          const fullExisting = await db.query.direct_message.findFirst({ where: { id: doc.id } });
          conflicts.push(fullExisting ?? doc);
          continue;
        }
      }

      const deletedAt = doc.deleted_at ? new Date(doc.deleted_at) : null;
      const editedAt = doc.edited_at ? new Date(doc.edited_at) : null;

      await db
        .insert(tables.direct_message)
        .values({
          id: doc.id,
          conversation_id: doc.conversation_id,
          author_id: doc.author_id,
          content: doc.content,
          edited_at: editedAt,
          reactions: doc.reactions,
          created_at: new Date(doc.created_at),
          updated_at: new Date(doc.updated_at),
          deleted_at: deletedAt,
        })
        .onConflictDoUpdate({
          target: tables.direct_message.id,
          set: {
            content: doc.content,
            edited_at: editedAt,
            reactions: doc.reactions,
            updated_at: new Date(doc.updated_at),
            deleted_at: deletedAt,
          },
        });
    }

    return conflicts;
  } catch (error: any) {
    if (error?.statusCode) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: `DM push failed: ${error.message || "Unknown error"}`,
    });
  }
});
