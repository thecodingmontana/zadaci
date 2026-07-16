import { and, eq, inArray } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface PushRow {
  assumedMasterState: {
    id: string;
    updated_at: string;
  } | null;
  newDocumentState: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    priority: string;
    project_id: string;
    due_date: string | null;
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

    console.log(
      "[rxdb-debug] tasks/push | userId:",
      userId,
      "| workspaceId:",
      workspaceId,
      "| rowCount:",
      body.length,
      "| deletedIds:",
      body.filter((r) => r.newDocumentState.deleted_at).map((r) => r.newDocumentState.id),
    );

    const membership = await db.query.workspace_members.findFirst({
      where: { user_id: userId, workspace_id: workspaceId },
    });
    if (!membership) {
      throw createError({ statusCode: 403, statusMessage: "Access denied" });
    }

    const projectIds = [...new Set(body.map((row) => row.newDocumentState.project_id))];

    const validProjects = await db
      .select({ id: tables.project.id })
      .from(tables.project)
      .where(
        and(eq(tables.project.workspace_id, workspaceId), inArray(tables.project.id, projectIds)),
      );

    const validProjectIdSet = new Set(validProjects.map((p) => p.id));
    const invalidRows = body.filter(
      (row) => !validProjectIdSet.has(row.newDocumentState.project_id),
    );
    if (invalidRows.length > 0) {
      throw createError({
        statusCode: 403,
        statusMessage: "Some rows reference projects not in this workspace",
      });
    }

    const taskIds = body.map((row) => row.newDocumentState.id);
    const existingTasks = await db
      .select({
        id: tables.task.id,
        updated_at: tables.task.updated_at,
        name: tables.task.name,
        description: tables.task.description,
        status: tables.task.status,
        priority: tables.task.priority,
        project_id: tables.task.project_id,
        due_date: tables.task.due_date,
        created_at: tables.task.created_at,
        deleted_at: tables.task.deleted_at,
      })
      .from(tables.task)
      .where(inArray(tables.task.id, taskIds));

    const existingMap = new Map(existingTasks.map((t) => [t.id, t]));
    const conflicts: any[] = [];

    for (const row of body) {
      const doc = row.newDocumentState;
      console.log("[rxdb-debug] task push row - id:", doc.id, "_deleted:", doc._deleted, "deleted_at:", doc.deleted_at, "deleted_at type:", typeof doc.deleted_at);
      const existing = existingMap.get(doc.id);

      if (existing) {
        const assumedUpdatedAt = row.assumedMasterState?.updated_at;
        const currentUpdatedAt = existing.updated_at.toISOString();

        if (assumedUpdatedAt && assumedUpdatedAt !== currentUpdatedAt) {
          conflicts.push({
            id: existing.id,
            name: existing.name,
            description: existing.description,
            status: existing.status,
            priority: existing.priority,
            project_id: existing.project_id,
            due_date: existing.due_date ? existing.due_date.toISOString() : null,
            created_at: existing.created_at.toISOString(),
            updated_at: currentUpdatedAt,
            deleted_at: existing.deleted_at ? existing.deleted_at.toISOString() : null,
          });
          continue;
        }
      }

      const dueDate = doc.due_date ? new Date(doc.due_date) : null;
      const deletedAt = doc.deleted_at ? new Date(doc.deleted_at) : null;

      if (deletedAt) {
        console.log("[rxdb-debug] tasks/push DELETE - id:", doc.id, "deleted_at:", deletedAt.toISOString());
      }

      await db
        .insert(tables.task)
        .values({
          id: doc.id,
          name: doc.name,
          description: doc.description,
          status: doc.status as any,
          priority: doc.priority as any,
          project_id: doc.project_id,
          due_date: dueDate,
          created_at: new Date(doc.created_at),
          updated_at: new Date(doc.updated_at),
          deleted_at: deletedAt,
        })
        .onConflictDoUpdate({
          target: tables.task.id,
          set: {
            name: doc.name,
            description: doc.description,
            status: doc.status as any,
            priority: doc.priority as any,
            project_id: doc.project_id,
            due_date: dueDate,
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
