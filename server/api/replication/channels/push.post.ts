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
    name: string | null;
    type: "public" | "private";
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

    const invalidRows = body.filter((row) => row.newDocumentState.workspace_id !== workspaceId);
    if (invalidRows.length > 0) {
      throw createError({
        statusCode: 403,
        statusMessage: "Some rows reference a different workspace",
      });
    }

    const channelIds = body.map((row) => row.newDocumentState.id);
    const existingChannels = await db
      .select({
        id: tables.channel.id,
        updated_at: tables.channel.updated_at,
        workspace_id: tables.channel.workspace_id,
        name: tables.channel.name,
        type: tables.channel.type,
        created_by: tables.channel.created_by,
        created_at: tables.channel.created_at,
        deleted_at: tables.channel.deleted_at,
      })
      .from(tables.channel)
      .where(inArray(tables.channel.id, channelIds));

    const existingMap = new Map(existingChannels.map((c) => [c.id, c]));
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
            workspace_id: existing.workspace_id,
            name: existing.name,
            type: existing.type,
            created_by: existing.created_by,
            created_at: existing.created_at.toISOString(),
            updated_at: currentUpdatedAt,
            deleted_at: existing.deleted_at ? existing.deleted_at.toISOString() : null,
          });
          continue;
        }
      }

      const deletedAt = doc.deleted_at ? new Date(doc.deleted_at) : null;

      await db
        .insert(tables.channel)
        .values({
          id: doc.id,
          workspace_id: doc.workspace_id,
          name: doc.name,
          type: doc.type,
          created_by: doc.created_by,
          created_at: new Date(doc.created_at),
          updated_at: new Date(doc.updated_at),
          deleted_at: deletedAt,
        })
        .onConflictDoUpdate({
          target: tables.channel.id,
          set: {
            workspace_id: doc.workspace_id,
            name: doc.name,
            type: doc.type,
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
