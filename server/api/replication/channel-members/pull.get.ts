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
    member_id: string;
    last_read_at: string | null;
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
    const workspaceId = query.workspace_id as string | undefined;
    const checkpointParam = query.checkpoint as string | undefined;
    const batchSize = Math.min(Number(query.batch_size) || 50, 100);

    if (!workspaceId) {
      return { documents: [], checkpoint: null } satisfies PullResponse;
    }

    const membership = await db.query.workspace_members.findFirst({
      where: { user_id: userId, workspace_id: workspaceId },
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

    const conditions = [eq(tables.channel_members.member_id, membership.id)];

    if (checkpoint) {
      conditions.push(
        or(
          gt(tables.channel_members.updated_at, new Date(checkpoint.updated_at)),
          and(
            sql`${tables.channel_members.updated_at} = ${checkpoint.updated_at}::timestamp with time zone`,
            gt(tables.channel_members.id, checkpoint.id),
          ),
        ),
      );
    }

    const rows = await db
      .select({
        id: tables.channel_members.id,
        channel_id: tables.channel_members.channel_id,
        member_id: tables.channel_members.member_id,
        last_read_at: tables.channel_members.last_read_at,
        created_at: tables.channel_members.created_at,
        updated_at: tables.channel_members.updated_at,
      })
      .from(tables.channel_members)
      .innerJoin(tables.channel, eq(tables.channel_members.channel_id, tables.channel.id))
      .where(and(...conditions))
      .orderBy(asc(tables.channel_members.updated_at), asc(tables.channel_members.id))
      .limit(batchSize);

    const lastRow = rows[rows.length - 1];
    const nextCheckpoint = lastRow
      ? { updated_at: lastRow.updated_at.toISOString(), id: lastRow.id }
      : null;

    const documents = rows.map((row) => ({
      id: row.id,
      channel_id: row.channel_id,
      member_id: row.member_id,
      last_read_at: row.last_read_at ? row.last_read_at.toISOString() : null,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    }));

    return { documents, checkpoint: nextCheckpoint } satisfies PullResponse;
  } catch (error: any) {
    if (error?.statusCode) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: `Pull failed: ${error.message || "Unknown error"}`,
    });
  }
});
