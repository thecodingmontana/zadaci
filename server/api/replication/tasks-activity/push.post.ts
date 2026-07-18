import { and, eq, inArray } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface PushRow {
  assumedMasterState: {
    id: string;
    updated_at: string;
  } | null;
  newDocumentState: {
    id: string;
    status: string;
    task_id: string;
    changed_by: string;
    changed_at: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    _deleted?: boolean;
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

    const activityIds = body.map((row) => row.newDocumentState.id);
    const existingActivities = await db
      .select({
        id: tables.tasks_activity.id,
        updated_at: tables.tasks_activity.updated_at,
        status: tables.tasks_activity.status,
        task_id: tables.tasks_activity.task_id,
        changed_by: tables.tasks_activity.changed_by,
        changed_at: tables.tasks_activity.changed_at,
        created_at: tables.tasks_activity.created_at,
        deleted_at: tables.tasks_activity.deleted_at,
      })
      .from(tables.tasks_activity)
      .where(inArray(tables.tasks_activity.id, activityIds));

    const existingMap = new Map(existingActivities.map((a) => [a.id, a]));
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
            status: existing.status,
            task_id: existing.task_id,
            changed_by: existing.changed_by,
            changed_at: existing.changed_at.toISOString(),
            created_at: existing.created_at.toISOString(),
            updated_at: currentUpdatedAt,
            deleted_at: existing.deleted_at ? existing.deleted_at.toISOString() : null,
          });
          continue;
        }
      }

      const deletedAt = doc.deleted_at ? new Date(doc.deleted_at) : null;

      await db
        .insert(tables.tasks_activity)
        .values({
          id: doc.id,
          status: doc.status as any,
          task_id: doc.task_id,
          changed_by: doc.changed_by,
          changed_at: new Date(doc.changed_at),
          created_at: new Date(doc.created_at),
          updated_at: new Date(doc.updated_at),
          deleted_at: deletedAt,
        })
        .onConflictDoUpdate({
          target: tables.tasks_activity.id,
          set: {
            status: doc.status as any,
            task_id: doc.task_id,
            changed_by: doc.changed_by,
            changed_at: new Date(doc.changed_at),
            updated_at: new Date(doc.updated_at),
            deleted_at: deletedAt,
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
