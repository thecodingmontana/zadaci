import { and, asc, eq, gt, or, sql } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface Checkpoint {
  updated_at: string;
  id: string;
}

interface PullResponse {
  documents: {
    id: string;
    user_id: string;
    status: "available" | "busy" | "away" | "dnd" | "offline";
    custom_message: string | null;
    status_expires_at: string | null;
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

    const conditions = [eq(tables.workspace_members.workspace_id, workspaceId)];

    if (checkpoint) {
      conditions.push(
        or(
          gt(tables.user_status.updated_at, new Date(checkpoint.updated_at)),
          and(
            sql`${tables.user_status.updated_at} = ${checkpoint.updated_at}::timestamp with time zone`,
            gt(tables.user_status.id, checkpoint.id),
          ),
        ),
      );
    }

    const rows = await db
      .select({
        id: tables.user_status.id,
        user_id: tables.user_status.user_id,
        status: tables.user_status.status,
        custom_message: tables.user_status.custom_message,
        status_expires_at: tables.user_status.status_expires_at,
        created_at: tables.user_status.created_at,
        updated_at: tables.user_status.updated_at,
      })
      .from(tables.user_status)
      .innerJoin(
        tables.workspace_members,
        eq(tables.user_status.user_id, tables.workspace_members.user_id),
      )
      .where(and(...conditions))
      .orderBy(asc(tables.user_status.updated_at), asc(tables.user_status.id))
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
      user_id: row.user_id,
      status: row.status as "available" | "busy" | "away" | "dnd" | "offline",
      custom_message: row.custom_message,
      status_expires_at: row.status_expires_at ? row.status_expires_at.toISOString() : null,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
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
