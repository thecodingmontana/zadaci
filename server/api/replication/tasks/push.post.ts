import { and, inArray, sql } from "drizzle-orm";
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

    const projectIds = [...new Set(body.map((row) => row.newDocumentState.project_id))];

    const membershipCheck = await db
      .select({ workspaceId: tables.project.workspace_id })
      .from(tables.project)
      .where(
        sql`${tables.project.id} IN (${sql.join(
          projectIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
      .innerJoin(
        tables.workspace_members,
        and(
          sql`${tables.workspace_members.workspace_id} = ${tables.project.workspace_id}`,
          sql`${tables.workspace_members.user_id} = ${userId}`,
        ),
      );

    if (membershipCheck.length === 0) {
      throw createError({ statusCode: 403, statusMessage: "Access denied" });
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
