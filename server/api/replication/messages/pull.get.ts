import { and, asc, eq, gt, or, sql } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface Checkpoint {
  updated_at: string;
  id: string;
}

interface PullResponse {
  documents: {
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
  }[];
  checkpoint: Checkpoint | null;
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
      return { documents: [], checkpoint: null } satisfies PullResponse;
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

    if (checkpoint) {
      conditions.push(
        or(
          gt(tables.message.updated_at, new Date(checkpoint.updated_at)),
          and(
            sql`${tables.message.updated_at} = ${checkpoint.updated_at}::timestamp with time zone`,
            gt(tables.message.id, checkpoint.id),
          ),
        ),
      );
    }

    const rows = await db
      .select()
      .from(tables.message)
      .where(and(...conditions))
      .orderBy(asc(tables.message.updated_at), asc(tables.message.id))
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
      channel_id: row.channel_id,
      author_id: row.author_id,
      content: row.content,
      edited_at: row.edited_at ? row.edited_at.toISOString() : null,
      reactions: row.reactions as { emoji: string; member_ids: string[] }[],
      parent_message_id: row.parent_message_id,
      thread_reply_count: row.thread_reply_count,
      thread_participant_ids: row.thread_participant_ids as string[],
      thread_last_reply_at: row.thread_last_reply_at
        ? row.thread_last_reply_at.toISOString()
        : null,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
      deleted_at: row.deleted_at ? row.deleted_at.toISOString() : null,
    }));

    return { documents, checkpoint: nextCheckpoint } satisfies PullResponse;
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
