import { and, eq, inArray } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface PushRow {
  assumedMasterState: {
    id: string;
    updated_at: string;
  } | null;
  newDocumentState: {
    id: string;
    task_id: string;
    member_id: string;
    assigned_at: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  };
}

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const userId = session.user.id;

    const body = await readBody<PushRow[]>(event);
    if (!Array.isArray(body) || body.length === 0) {
      return [];
    }

    const query = getQuery(event);
    const workspaceId = query.workspace_id as string | undefined;
    if (!workspaceId) {
      throw createError({ statusCode: 400, statusMessage: "workspace_id is required" });
    }

    console.log(
      "[rxdb-debug] task-assignees/push | userId:",
      userId,
      "| workspaceId:",
      workspaceId,
      "| rowCount:",
      body.length,
    );

    const membership = await db.query.workspace_members.findFirst({
      where: { user_id: userId, workspace_id: workspaceId },
    });
    if (!membership) {
      throw createError({ statusCode: 403, statusMessage: "Access denied" });
    }

    const taskIds = [...new Set(body.map((row) => row.newDocumentState.task_id))];

    const validTasks = await db
      .select({ id: tables.task.id })
      .from(tables.task)
      .innerJoin(tables.project, eq(tables.task.project_id, tables.project.id))
      .where(and(eq(tables.project.workspace_id, workspaceId), inArray(tables.task.id, taskIds)));

    const validTaskIdSet = new Set(validTasks.map((t) => t.id));
    const invalidRows = body.filter((row) => !validTaskIdSet.has(row.newDocumentState.task_id));
    if (invalidRows.length > 0) {
      throw createError({
        statusCode: 403,
        statusMessage: "Some rows reference tasks not in this workspace",
      });
    }

    const taIds = body.map((row) => row.newDocumentState.id);
    const existingTAs = await db
      .select({
        id: tables.task_assignees.id,
        updated_at: tables.task_assignees.updated_at,
        task_id: tables.task_assignees.task_id,
        member_id: tables.task_assignees.member_id,
        assigned_at: tables.task_assignees.assigned_at,
        created_at: tables.task_assignees.created_at,
        deleted_at: tables.task_assignees.deleted_at,
      })
      .from(tables.task_assignees)
      .where(inArray(tables.task_assignees.id, taIds));

    const existingMap = new Map(existingTAs.map((t) => [t.id, t]));
    const conflicts: any[] = [];

    for (const row of body) {
      const doc = row.newDocumentState;
      const existing = existingMap.get(doc.id);

      if (existing) {
        const assumedUpdatedAt = row.assumedMasterState?.updated_at;
        const currentUpdatedAt = existing.updated_at.toISOString();

        if (assumedUpdatedAt && assumedUpdatedAt !== currentUpdatedAt) {
          conflicts.push({
            id: existing.id,
            task_id: existing.task_id,
            member_id: existing.member_id,
            assigned_at: existing.assigned_at.toISOString(),
            created_at: existing.created_at.toISOString(),
            updated_at: currentUpdatedAt,
            deleted_at: existing.deleted_at ? existing.deleted_at.toISOString() : null,
          });
          continue;
        }
      }

      await db
        .insert(tables.task_assignees)
        .values({
          id: doc.id,
          task_id: doc.task_id,
          member_id: doc.member_id,
          assigned_at: new Date(doc.assigned_at),
          created_at: new Date(doc.created_at),
          updated_at: new Date(doc.updated_at),
          deleted_at: doc.deleted_at ? new Date(doc.deleted_at) : null,
        })
        .onConflictDoUpdate({
          target: tables.task_assignees.id,
          set: {
            task_id: doc.task_id,
            member_id: doc.member_id,
            assigned_at: new Date(doc.assigned_at),
            updated_at: new Date(doc.updated_at),
            deleted_at: doc.deleted_at ? new Date(doc.deleted_at) : null,
          },
        });
    }

    return conflicts;
  } catch (error: any) {
    if (error?.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      statusMessage: `Push failed: ${error.message || "Unknown error"}`,
    });
  }
});
