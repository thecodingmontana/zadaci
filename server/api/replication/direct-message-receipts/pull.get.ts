import { and, asc, eq, gt, or, sql } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface Checkpoint {
  updated_at: string;
  id: string;
}
interface PullResponse {
  documents: {
    id: string;
    direct_message_id: string;
    member_id: string;
    status: string;
    created_at: string;
    updated_at: string;
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
    if (!conversation)
      throw createError({ statusCode: 404, statusMessage: "Conversation not found" });

    const membership = await db.query.workspace_members.findFirst({
      where: { user_id: userId, workspace_id: conversation.workspace_id },
    });
    if (!membership) throw createError({ statusCode: 403, statusMessage: "Access denied" });
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

    const conditions = [
      eq(tables.direct_message_receipt.member_id, membership.id),
      sql`EXISTS (SELECT 1 FROM ${tables.direct_message} dm WHERE dm.id = ${tables.direct_message_receipt.direct_message_id} AND dm.conversation_id = ${conversationId})`,
    ];

    if (checkpoint) {
      conditions.push(
        or(
          gt(tables.direct_message_receipt.updated_at, new Date(checkpoint.updated_at)),
          and(
            sql`${tables.direct_message_receipt.updated_at} = ${checkpoint.updated_at}::timestamp with time zone`,
            gt(tables.direct_message_receipt.id, checkpoint.id),
          ),
        ),
      );
    }

    const rows = await db
      .select()
      .from(tables.direct_message_receipt)
      .where(and(...conditions))
      .orderBy(asc(tables.direct_message_receipt.updated_at), asc(tables.direct_message_receipt.id))
      .limit(batchSize);

    const lastRow = rows[rows.length - 1];
    const nextCheckpoint = lastRow
      ? { updated_at: lastRow.updated_at.toISOString(), id: lastRow.id }
      : null;

    const documents = rows.map((row) => ({
      id: row.id,
      direct_message_id: row.direct_message_id,
      member_id: row.member_id,
      status: row.status,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    }));

    return { documents, checkpoint: nextCheckpoint } satisfies PullResponse;
  } catch (error: any) {
    if (error?.statusCode) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: `DM receipt pull failed: ${error.message || "Unknown error"}`,
    });
  }
});
