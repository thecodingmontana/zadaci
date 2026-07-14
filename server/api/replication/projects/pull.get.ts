import { and, asc, eq, gt, or, sql } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface Checkpoint {
  updated_at: string;
  id: string;
}

interface PullResponse {
  documents: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    workspace_id: string;
    due_date: string | null;
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
    const workspaceId = query.workspace_id as string | undefined;
    const checkpointParam = query.checkpoint as string | undefined;
    const batchSize = Math.min(Number(query.batch_size) || 50, 100);

    console.log(
      "[rxdb-debug] projects/pull | userId:",
      userId,
      "| workspaceId:",
      workspaceId,
      "| batchSize:",
      batchSize,
      "| hasCheckpoint:",
      !!checkpointParam,
    );

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

    const conditions = [eq(tables.project.workspace_id, workspaceId)];

    if (checkpoint) {
      conditions.push(
        or(
          gt(tables.project.updated_at, new Date(checkpoint.updated_at)),
          and(
            sql`${tables.project.updated_at} = ${checkpoint.updated_at}::timestamp with time zone`,
            gt(tables.project.id, checkpoint.id),
          ),
        ),
      );
    }

    const rows = await db
      .select({
        id: tables.project.id,
        title: tables.project.title,
        description: tables.project.description,
        status: tables.project.status,
        priority: tables.project.priority,
        workspace_id: tables.project.workspace_id,
        due_date: tables.project.due_date,
        created_at: tables.project.created_at,
        updated_at: tables.project.updated_at,
        deleted_at: tables.project.deleted_at,
      })
      .from(tables.project)
      .where(and(...conditions))
      .orderBy(asc(tables.project.updated_at), asc(tables.project.id))
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
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      workspace_id: row.workspace_id,
      due_date: row.due_date ? row.due_date.toISOString() : null,
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
