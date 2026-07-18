import { and, asc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface Checkpoint {
  updated_at: string;
  id: string;
}

interface PullResponse {
  documents: {
    id: string;
    task_id: string;
    member_id: string;
    assigned_at: string;
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
      "[rxdb-debug] task-assignees/pull | userId:",
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

    const workspaceTasks = await db
      .select({ id: tables.task.id })
      .from(tables.task)
      .where(inArray(tables.task.project_id, projectIds));

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

    const conditions = [
      inArray(tables.task_assignees.task_id, taskIds),
      eq(tables.task_assignees.deleted_at, null),
    ];

    if (checkpoint) {
      conditions.push(
        or(
          gt(tables.task_assignees.updated_at, new Date(checkpoint.updated_at)),
          and(
            sql`${tables.task_assignees.updated_at} = ${checkpoint.updated_at}::timestamp with time zone`,
            gt(tables.task_assignees.id, checkpoint.id),
          ),
        ),
      );
    }

    const rows = await db
      .select({
        id: tables.task_assignees.id,
        task_id: tables.task_assignees.task_id,
        member_id: tables.task_assignees.member_id,
        assigned_at: tables.task_assignees.assigned_at,
        created_at: tables.task_assignees.created_at,
        updated_at: tables.task_assignees.updated_at,
        deleted_at: tables.task_assignees.deleted_at,
      })
      .from(tables.task_assignees)
      .where(and(...conditions))
      .orderBy(asc(tables.task_assignees.updated_at), asc(tables.task_assignees.id))
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
      task_id: row.task_id,
      member_id: row.member_id,
      assigned_at: row.assigned_at.toISOString(),
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
