import { and, asc, eq, gt, or, sql } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface Checkpoint {
  updated_at: string;
  id: string;
}
interface PullResponse {
  documents: {
    id: string;
    conversation_id: string;
    author_id: string;
    content: string;
    edited_at: string | null;
    reactions: { emoji: string; member_ids: string[] }[];
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  }[];
  checkpoint: Checkpoint | null;
}

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const userId = session.user.id;

    const query = getQuery(event);
    const conversationId = query.conversation_id as string | undefined;
    const checkpointParam = query.checkpoint as string | undefined;
    const batchSize = Math.min(Number(query.batch_size) || 50, 100);

    if (!conversationId) {
      return { documents: [], checkpoint: null } satisfies PullResponse;
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

    let checkpoint: Checkpoint | null = null;
    if (checkpointParam) {
      try {
        checkpoint = JSON.parse(checkpointParam) as Checkpoint;
      } catch {
        checkpoint = null;
      }
    }

    const conditions = [eq(tables.direct_message.conversation_id, conversationId)];

    if (checkpoint) {
      conditions.push(
        or(
          gt(tables.direct_message.updated_at, new Date(checkpoint.updated_at)),
          and(
            sql`${tables.direct_message.updated_at} = ${checkpoint.updated_at}::timestamp with time zone`,
            gt(tables.direct_message.id, checkpoint.id),
          ),
        ),
      );
    }

    const rows = await db
      .select()
      .from(tables.direct_message)
      .where(and(...conditions))
      .orderBy(asc(tables.direct_message.updated_at), asc(tables.direct_message.id))
      .limit(batchSize);

    const lastRow = rows[rows.length - 1];
    const nextCheckpoint: Checkpoint | null = lastRow
      ? { updated_at: lastRow.updated_at.toISOString(), id: lastRow.id }
      : null;

    const documents = rows.map((row) => ({
      id: row.id,
      conversation_id: row.conversation_id,
      author_id: row.author_id,
      content: row.content,
      edited_at: row.edited_at ? row.edited_at.toISOString() : null,
      reactions: row.reactions as { emoji: string; member_ids: string[] }[],
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
      deleted_at: row.deleted_at ? row.deleted_at.toISOString() : null,
    }));

    return { documents, checkpoint: nextCheckpoint } satisfies PullResponse;
  } catch (error: any) {
    if (error?.statusCode) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: `Direct message pull failed: ${error.message || "Unknown error"}`,
    });
  }
});
