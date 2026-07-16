import { inArray } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface PushRow {
  assumedMasterState: {
    id: string;
    updated_at: string;
  } | null;
  newDocumentState: {
    id: string;
    user_id: string;
    status: "available" | "busy" | "away" | "dnd" | "offline";
    custom_message: string | null;
    status_expires_at: string | null;
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

    const usIds = body.map((row) => row.newDocumentState.id);
    const existingDocs = await db
      .select({
        id: tables.user_status.id,
        updated_at: tables.user_status.updated_at,
        user_id: tables.user_status.user_id,
        status: tables.user_status.status,
        custom_message: tables.user_status.custom_message,
        status_expires_at: tables.user_status.status_expires_at,
        created_at: tables.user_status.created_at,
      })
      .from(tables.user_status)
      .where(inArray(tables.user_status.id, usIds));

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
            user_id: existing.user_id,
            status: existing.status,
            custom_message: existing.custom_message,
            status_expires_at: existing.status_expires_at
              ? existing.status_expires_at.toISOString()
              : null,
            created_at: existing.created_at.toISOString(),
            updated_at: currentUpdatedAt,
          });
          continue;
        }
      }

      await db
        .insert(tables.user_status)
        .values({
          id: doc.id,
          user_id: doc.user_id,
          status: doc.status,
          custom_message: doc.custom_message,
          status_expires_at: doc.status_expires_at ? new Date(doc.status_expires_at) : null,
          created_at: new Date(doc.created_at),
          updated_at: new Date(doc.updated_at),
        })
        .onConflictDoUpdate({
          target: tables.user_status.id,
          set: {
            status: doc.status,
            custom_message: doc.custom_message,
            status_expires_at: doc.status_expires_at ? new Date(doc.status_expires_at) : null,
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
