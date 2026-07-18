import { and, asc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface Checkpoint {
  updated_at: string;
  id: string;
}

interface PullResponse {
  documents: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    priority: string;
    project_id: string;
    parent_task_id: string | null;
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
      "[rxdb-debug] tasks/pull | userId:",
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

    const workspaceProjects = await db
      .select({ id: tables.project.id })
      .from(tables.project)
      .where(eq(tables.project.workspace_id, workspaceId));

    const projectIds = workspaceProjects.map((p) => p.id);
    if (projectIds.length === 0) {
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

    const conditions = [inArray(tables.task.project_id, projectIds)];

    if (checkpoint) {
      conditions.push(
        or(
          gt(tables.task.updated_at, new Date(checkpoint.updated_at)),
          and(
            sql`${tables.task.updated_at} = ${checkpoint.updated_at}::timestamp with time zone`,
            gt(tables.task.id, checkpoint.id),
          ),
        ),
      );
    }

    const rows = await db
      .select({
        id: tables.task.id,
        name: tables.task.name,
        description: tables.task.description,
        status: tables.task.status,
        priority: tables.task.priority,
        project_id: tables.task.project_id,
        parent_task_id: tables.task.parent_task_id,
        due_date: tables.task.due_date,
        created_at: tables.task.created_at,
        updated_at: tables.task.updated_at,
        deleted_at: tables.task.deleted_at,
      })
      .from(tables.task)
      .where(and(...conditions))
      .orderBy(asc(tables.task.updated_at), asc(tables.task.id))
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
      name: row.name,
      description: row.description,
      status: row.status,
      priority: row.priority,
      project_id: row.project_id,
      parent_task_id: row.parent_task_id,
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
