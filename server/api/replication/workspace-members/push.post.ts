import { inArray } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface PushRow {
  assumedMasterState: {
    id: string;
    updated_at: string;
  } | null;
  newDocumentState: {
    id: string;
    role: "owner" | "member" | "guest";
    user_id: string;
    workspace_id: string;
    created_at: string;
    updated_at: string;
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

    const wmIds = body.map((row) => row.newDocumentState.id);
    const existingDocs = await db
      .select({
        id: tables.workspace_members.id,
        updated_at: tables.workspace_members.updated_at,
        role: tables.workspace_members.role,
        user_id: tables.workspace_members.user_id,
        workspace_id: tables.workspace_members.workspace_id,
        created_at: tables.workspace_members.created_at,
      })
      .from(tables.workspace_members)
      .where(inArray(tables.workspace_members.id, wmIds));

    const existingMap = new Map(existingDocs.map((d) => [d.id, d]));
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
            role: existing.role,
            user_id: existing.user_id,
            workspace_id: existing.workspace_id,
            created_at: existing.created_at.toISOString(),
            updated_at: currentUpdatedAt,
          });
          continue;
        }
      }

      await db
        .insert(tables.workspace_members)
        .values({
          id: doc.id,
          role: doc.role,
          user_id: doc.user_id,
          workspace_id: doc.workspace_id,
          created_at: new Date(doc.created_at),
          updated_at: new Date(doc.updated_at),
        })
        .onConflictDoUpdate({
          target: tables.workspace_members.id,
          set: {
            role: doc.role,
            updated_at: new Date(doc.updated_at),
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
