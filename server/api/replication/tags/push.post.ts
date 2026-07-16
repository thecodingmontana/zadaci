import { inArray } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface PushRow {
  assumedMasterState: {
    id: string;
    updated_at: string;
  } | null;
  newDocumentState: {
    id: string;
    workspace_id: string;
    name: string;
    color: string | null;
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
      "[rxdb-debug] tags/push | userId:",
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

    const tagIds = body.map((row) => row.newDocumentState.id);
    const existingTags = await db
      .select({
        id: tables.tag.id,
        updated_at: tables.tag.updated_at,
        name: tables.tag.name,
        color: tables.tag.color,
        workspace_id: tables.tag.workspace_id,
        created_at: tables.tag.created_at,
        deleted_at: tables.tag.deleted_at,
      })
      .from(tables.tag)
      .where(inArray(tables.tag.id, tagIds));

    const existingMap = new Map(existingTags.map((t) => [t.id, t]));
    const conflicts: any[] = [];

    for (const row of body) {
      const doc = row.newDocumentState;
      console.log(
        "[rxdb-debug] tag push row - id:",
        doc.id,
        "deleted_at:",
        doc.deleted_at,
        "deleted_at type:",
        typeof doc.deleted_at,
      );
      const existing = existingMap.get(doc.id);

      if (existing) {
        const assumedUpdatedAt = row.assumedMasterState?.updated_at;
        const currentUpdatedAt = existing.updated_at.toISOString();

        if (assumedUpdatedAt && assumedUpdatedAt !== currentUpdatedAt) {
          conflicts.push({
            id: existing.id,
            workspace_id: existing.workspace_id,
            name: existing.name,
            color: existing.color,
            created_at: existing.created_at.toISOString(),
            updated_at: currentUpdatedAt,
            deleted_at: existing.deleted_at ? existing.deleted_at.toISOString() : null,
          });
          continue;
        }
      }

      const deletedAt = doc.deleted_at ? new Date(doc.deleted_at) : null;

      if (deletedAt) {
        console.log(
          "[rxdb-debug] tags/push DELETE - id:",
          doc.id,
          "deleted_at:",
          deletedAt.toISOString(),
        );
      }

      await db
        .insert(tables.tag)
        .values({
          id: doc.id,
          workspace_id: doc.workspace_id,
          name: doc.name,
          color: doc.color,
          created_at: new Date(doc.created_at),
          updated_at: new Date(doc.updated_at),
          deleted_at: deletedAt,
        })
        .onConflictDoUpdate({
          target: tables.tag.id,
          set: {
            workspace_id: doc.workspace_id,
            name: doc.name,
            color: doc.color,
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
