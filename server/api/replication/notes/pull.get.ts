import { and, asc, eq, gt, or, sql } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface Checkpoint {
  updated_at: string;
  id: string;
}
interface PullResponse {
  documents: {
    id: string;
    workspace_id: string;
    title: string;
    content: string | null;
    created_by: string;
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

    if (!workspaceId) {
      return { documents: [], checkpoint: null } satisfies PullResponse;
    }

    const membership = await db.query.workspace_members.findFirst({
      where: { user_id: userId, workspace_id: workspaceId },
    });
    if (!membership) throw createError({ statusCode: 403, statusMessage: "Access denied" });

    let checkpoint: Checkpoint | null = null;
    if (checkpointParam) {
      try {
        checkpoint = JSON.parse(checkpointParam) as Checkpoint;
      } catch {
        checkpoint = null;
      }
    }

    const conditions = [eq(tables.note.workspace_id, workspaceId)];

    if (checkpoint) {
      conditions.push(
        or(
          gt(tables.note.updated_at, new Date(checkpoint.updated_at)),
          and(
            sql`${tables.note.updated_at} = ${checkpoint.updated_at}::timestamp with time zone`,
            gt(tables.note.id, checkpoint.id),
          ),
        ),
      );
    }

    const rows = await db
      .select()
      .from(tables.note)
      .where(and(...conditions))
      .orderBy(asc(tables.note.updated_at), asc(tables.note.id))
      .limit(batchSize);

    const lastRow = rows[rows.length - 1];
    const nextCheckpoint = lastRow
      ? { updated_at: lastRow.updated_at.toISOString(), id: lastRow.id }
      : null;

    const documents = rows.map((row) => ({
      id: row.id,
      workspace_id: row.workspace_id,
      title: row.title,
      content: row.content,
      created_by: row.created_by,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
      deleted_at: row.deleted_at ? row.deleted_at.toISOString() : null,
    }));

    return { documents, checkpoint: nextCheckpoint } satisfies PullResponse;
  } catch (error: any) {
    if (error?.statusCode) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: `Note pull failed: ${error.message || "Unknown error"}`,
    });
  }
});
