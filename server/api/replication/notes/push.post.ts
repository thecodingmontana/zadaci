import { inArray } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface PushRow {
  assumedMasterState: { id: string; updated_at: string } | null;
  newDocumentState: {
    id: string;
    workspace_id: string;
    title: string;
    content: string | null;
    created_by: string;
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
    if (!Array.isArray(body) || body.length === 0) return [];

    const query = getQuery(event);
    const workspaceId = query.workspace_id as string | undefined;
    if (!workspaceId)
      throw createError({ statusCode: 400, statusMessage: "workspace_id is required" });

    const membership = await db.query.workspace_members.findFirst({
      where: { user_id: userId, workspace_id: workspaceId },
    });
    if (!membership) throw createError({ statusCode: 403, statusMessage: "Access denied" });

    const invalidAuthor = body.filter((row) => row.newDocumentState.created_by !== membership.id);
    if (invalidAuthor.length > 0) {
      throw createError({
        statusCode: 403,
        statusMessage: "Cannot create notes as another member",
      });
    }

    const ids = body.map((r) => r.newDocumentState.id);
    const existing = await db
      .select({ id: tables.note.id, updated_at: tables.note.updated_at })
      .from(tables.note)
      .where(inArray(tables.note.id, ids));

    const existingMap = new Map(existing.map((m) => [m.id, m]));
    const conflicts: any[] = [];

    for (const row of body) {
      const doc = row.newDocumentState;
      const existingDoc = existingMap.get(doc.id);

      if (existingDoc) {
        if (
          row.assumedMasterState?.updated_at &&
          row.assumedMasterState.updated_at !== existingDoc.updated_at.toISOString()
        ) {
          const full = await db.query.note.findFirst({ where: { id: doc.id } });
          conflicts.push(full ?? doc);
          continue;
        }
      }

      const deletedAt = doc.deleted_at ? new Date(doc.deleted_at) : null;

      await db
        .insert(tables.note)
        .values({
          id: doc.id,
          workspace_id: doc.workspace_id,
          title: doc.title,
          content: doc.content,
          created_by: doc.created_by,
          created_at: new Date(doc.created_at),
          updated_at: new Date(doc.updated_at),
          deleted_at: deletedAt,
        })
        .onConflictDoUpdate({
          target: tables.note.id,
          set: {
            title: doc.title,
            content: doc.content,
            updated_at: new Date(doc.updated_at),
            deleted_at: deletedAt,
          },
        });
    }

    return conflicts;
  } catch (error: any) {
    if (error?.statusCode) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: `Note push failed: ${error.message || "Unknown error"}`,
    });
  }
});
