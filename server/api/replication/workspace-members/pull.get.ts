import { and, asc, eq, gt, or, sql } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface Checkpoint {
  updated_at: string;
  id: string;
}

interface PullResponse {
  documents: {
    id: string;
    role: "owner" | "moderator" | "member";
    user_id: string;
    workspace_id: string;
    username: string;
    profile_picture_url: string | null;
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
          gt(tables.workspace_members.updated_at, new Date(checkpoint.updated_at)),
          and(
            sql`${tables.workspace_members.updated_at} = ${checkpoint.updated_at}::timestamp with time zone`,
            gt(tables.workspace_members.id, checkpoint.id),
          ),
        ),
      );
    }

    const rows = await db
      .select({
        id: tables.workspace_members.id,
        role: tables.workspace_members.role,
        user_id: tables.workspace_members.user_id,
        workspace_id: tables.workspace_members.workspace_id,
        username: tables.user.username,
        profile_picture_url: tables.user.profile_picture_url,
        created_at: tables.workspace_members.created_at,
        updated_at: tables.workspace_members.updated_at,
      })
      .from(tables.workspace_members)
      .innerJoin(tables.user, eq(tables.workspace_members.user_id, tables.user.id))
      .where(and(...conditions))
      .orderBy(asc(tables.workspace_members.updated_at), asc(tables.workspace_members.id))
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
      role: row.role as "owner" | "moderator" | "member",
      user_id: row.user_id,
      workspace_id: row.workspace_id,
      username: row.username,
      profile_picture_url: row.profile_picture_url,
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
