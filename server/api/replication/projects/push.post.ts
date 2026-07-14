import { inArray } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface PushRow {
  assumedMasterState: {
    id: string;
    updated_at: string;
  } | null;
  newDocumentState: {
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
      "[rxdb-debug] projects/push | userId:",
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

    const invalidRows = body.filter((row) => row.newDocumentState.workspace_id !== workspaceId);
    if (invalidRows.length > 0) {
      throw createError({
        statusCode: 403,
        statusMessage: "Some rows reference a different workspace",
      });
    }

    const projectIds = body.map((row) => row.newDocumentState.id);
    const existingProjects = await db
      .select({
        id: tables.project.id,
        updated_at: tables.project.updated_at,
        title: tables.project.title,
        description: tables.project.description,
        status: tables.project.status,
        priority: tables.project.priority,
        workspace_id: tables.project.workspace_id,
        due_date: tables.project.due_date,
        created_at: tables.project.created_at,
        deleted_at: tables.project.deleted_at,
      })
      .from(tables.project)
      .where(inArray(tables.project.id, projectIds));

    const existingMap = new Map(existingProjects.map((p) => [p.id, p]));
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
            title: existing.title,
            description: existing.description,
            status: existing.status,
            priority: existing.priority,
            workspace_id: existing.workspace_id,
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

      await db
        .insert(tables.project)
        .values({
          id: doc.id,
          title: doc.title,
          description: doc.description,
          status: doc.status as any,
          priority: doc.priority as any,
          workspace_id: doc.workspace_id,
          due_date: dueDate,
          created_at: new Date(doc.created_at),
          updated_at: new Date(doc.updated_at),
          deleted_at: deletedAt,
        })
        .onConflictDoUpdate({
          target: tables.project.id,
          set: {
            title: doc.title,
            description: doc.description,
            status: doc.status as any,
            priority: doc.priority as any,
            workspace_id: doc.workspace_id,
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
