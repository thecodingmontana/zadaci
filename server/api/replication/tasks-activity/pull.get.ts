import { and, asc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface Checkpoint {
  updated_at: string;
  id: string;
}

interface PullResponse {
  documents: {
    id: string;
    status: string;
    task_id: string;
    changed_by: string;
    changed_at: string;
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
    if (!membership) {
      throw createError({ statusCode: 403, statusMessage: "Access denied" });
    }

    const workspaceTasks = await db
      .select({ id: tables.task.id })
      .from(tables.task)
      .innerJoin(tables.project, eq(tables.task.project_id, tables.project.id))
      .where(eq(tables.project.workspace_id, workspaceId));

    const taskIds = workspaceTasks.map((t) => t.id);
    if (taskIds.length === 0) {
      return { documents: [], checkpoint: null } satisfies PullResponse;
    }

    let checkpoint: Checkpoint | null = null;
    if (checkpointParam) {
      try {
        checkpoint = JSON.parse(checkpointParam) as Checkpoint;
      } catch {
        checkpoint = null;
      }
    }

    const conditions = [inArray(tables.tasks_activity.task_id, taskIds)];

    if (checkpoint) {
      conditions.push(
        or(
          gt(tables.tasks_activity.updated_at, new Date(checkpoint.updated_at)),
          and(
            sql`${tables.tasks_activity.updated_at} = ${checkpoint.updated_at}::timestamp with time zone`,
            gt(tables.tasks_activity.id, checkpoint.id),
          ),
        ),
      );
    }

    const rows = await db
      .select({
        id: tables.tasks_activity.id,
        status: tables.tasks_activity.status,
        task_id: tables.tasks_activity.task_id,
        changed_by: tables.tasks_activity.changed_by,
        changed_at: tables.tasks_activity.changed_at,
        created_at: tables.tasks_activity.created_at,
        updated_at: tables.tasks_activity.updated_at,
        deleted_at: tables.tasks_activity.deleted_at,
      })
      .from(tables.tasks_activity)
      .where(and(...conditions))
      .orderBy(asc(tables.tasks_activity.updated_at), asc(tables.tasks_activity.id))
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
      status: row.status,
      task_id: row.task_id,
      changed_by: row.changed_by,
      changed_at: row.changed_at.toISOString(),
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
