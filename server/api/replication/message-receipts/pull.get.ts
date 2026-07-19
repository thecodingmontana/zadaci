import { and, asc, eq, gt, or, sql } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface Checkpoint {
  updated_at: string;
  id: string;
}

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const userId = session.user.id;

    const query = getQuery(event);
    const channelId = query.channel_id as string | undefined;
    const checkpointParam = query.checkpoint as string | undefined;
    const batchSize = Math.min(Number(query.batch_size) || 50, 100);

    if (!channelId) {
      return { documents: [], checkpoint: null };
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

    let checkpoint: Checkpoint | null = null;
    if (checkpointParam) {
      try {
        checkpoint = JSON.parse(checkpointParam) as Checkpoint;
      } catch {
        checkpoint = null;
      }
    }

    const conditions = [eq(tables.message.channel_id, channelId)];
    const messageSubquery = db
      .select({ id: tables.message.id })
      .from(tables.message)
      .where(and(...conditions));

    const receiptConditions = [eq(tables.message_receipt.message_id, sql`ANY(${messageSubquery})`)];

    if (checkpoint) {
      receiptConditions.push(
        or(
          gt(tables.message_receipt.updated_at, new Date(checkpoint.updated_at)),
          and(
            sql`${tables.message_receipt.updated_at} = ${checkpoint.updated_at}::timestamp with time zone`,
            gt(tables.message_receipt.id, checkpoint.id),
          ),
        ),
      );
    }

    const rows = await db
      .select()
      .from(tables.message_receipt)
      .where(and(...receiptConditions))
      .orderBy(asc(tables.message_receipt.updated_at), asc(tables.message_receipt.id))
      .limit(batchSize);

    const lastRow = rows[rows.length - 1];
    const nextCheckpoint: Checkpoint | null = lastRow
      ? {
          updated_at: lastRow.updated_at.toISOString(),
          id: lastRow.id,
        }
      : null;

    const documents = rows.map((row) => ({
      id: row.id,
      message_id: row.message_id,
      member_id: row.member_id,
      status: row.status as "delivered" | "seen",
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    }));

    return { documents, checkpoint: nextCheckpoint };
  } catch (error: any) {
    if (error?.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      statusMessage: `Pull failed: ${error.message || "Unknown error"}`,
    });
  }
});
