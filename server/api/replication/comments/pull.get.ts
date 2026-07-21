import { and, asc, eq, gt, or, sql } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface Checkpoint {
  updated_at: string;
  id: string;
}
interface PullResponse {
  documents: {
    id: string;
    entity_type: string;
    entity_id: string;
    author_id: string;
    content: string;
    parent_id: string | null;
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
    const entityType = query.entity_type as string | undefined;
    const entityId = query.entity_id as string | undefined;
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

    const conditions = [] as any[];

    if (entityType && entityId) {
      conditions.push(
        eq(tables.comment.entity_type, entityType),
        eq(tables.comment.entity_id, entityId),
      );
    }

    if (checkpoint) {
      conditions.push(
        or(
          gt(tables.comment.updated_at, new Date(checkpoint.updated_at)),
          and(
            sql`${tables.comment.updated_at} = ${checkpoint.updated_at}::timestamp with time zone`,
            gt(tables.comment.id, checkpoint.id),
          ),
        ),
      );
    }

    const rows = await db
      .select()
      .from(tables.comment)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(tables.comment.updated_at), asc(tables.comment.id))
      .limit(batchSize);

    const lastRow = rows[rows.length - 1];
    const nextCheckpoint = lastRow
      ? { updated_at: lastRow.updated_at.toISOString(), id: lastRow.id }
      : null;

    const documents = rows.map((row) => ({
      id: row.id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      author_id: row.author_id,
      content: row.content,
      parent_id: row.parent_id,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
      deleted_at: row.deleted_at ? row.deleted_at.toISOString() : null,
    }));

    return { documents, checkpoint: nextCheckpoint } satisfies PullResponse;
  } catch (error: any) {
    if (error?.statusCode) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: `Comment pull failed: ${error.message || "Unknown error"}`,
    });
  }
});
