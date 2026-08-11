import { inArray } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface PushRow {
  assumedMasterState: { id: string; updated_at: string } | null;
  newDocumentState: {
    id: string;
    entity_type: string;
    entity_id: string;
    author_id: string;
    content: string;
    parent_id: string | null;
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

    const invalidAuthor = body.filter((row) => row.newDocumentState.author_id !== membership.id);
    if (invalidAuthor.length > 0) {
      throw createError({ statusCode: 403, statusMessage: "Cannot post as another member" });
    }

    const ids = body.map((r) => r.newDocumentState.id);
    const existing = await db
      .select({ id: tables.comment.id, updated_at: tables.comment.updated_at })
      .from(tables.comment)
      .where(inArray(tables.comment.id, ids));

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
          const full = await db.query.comment.findFirst({ where: { id: doc.id } });
          conflicts.push(full ?? doc);
          continue;
        }
      }

      const deletedAt = doc.deleted_at ? new Date(doc.deleted_at) : null;

      await db
        .insert(tables.comment)
        .values({
          id: doc.id,
          entity_type: doc.entity_type,
          entity_id: doc.entity_id,
          author_id: doc.author_id,
          content: doc.content,
          parent_id: doc.parent_id,
          created_at: new Date(doc.created_at),
          updated_at: new Date(doc.updated_at),
          deleted_at: deletedAt,
        })
        .onConflictDoUpdate({
          target: tables.comment.id,
          set: {
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
      statusMessage: `Comment push failed: ${error.message || "Unknown error"}`,
    });
  }
});
