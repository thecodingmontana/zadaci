import { inArray } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface PushRow {
  assumedMasterState: {
    id: string;
    updated_at: string;
  } | null;
  newDocumentState: {
    id: string;
    channel_id: string;
    member_id: string;
    last_read_at: string | null;
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

    const cmIds = body.map((row) => row.newDocumentState.id);
    const existing = await db
      .select({
        id: tables.channel_members.id,
        updated_at: tables.channel_members.updated_at,
        channel_id: tables.channel_members.channel_id,
        member_id: tables.channel_members.member_id,
        last_read_at: tables.channel_members.last_read_at,
        created_at: tables.channel_members.created_at,
      })
      .from(tables.channel_members)
      .where(inArray(tables.channel_members.id, cmIds));

    const existingMap = new Map(existing.map((c) => [c.id, c]));
    const conflicts: any[] = [];

    for (const row of body) {
      const doc = row.newDocumentState;
      const existingDoc = existingMap.get(doc.id);

      if (existingDoc) {
        const assumedUpdatedAt = row.assumedMasterState?.updated_at;
        const currentUpdatedAt = existingDoc.updated_at.toISOString();

        if (assumedUpdatedAt && assumedUpdatedAt !== currentUpdatedAt) {
          conflicts.push({
            id: existingDoc.id,
            channel_id: existingDoc.channel_id,
            member_id: existingDoc.member_id,
            last_read_at: existingDoc.last_read_at ? existingDoc.last_read_at.toISOString() : null,
            created_at: existingDoc.created_at.toISOString(),
            updated_at: currentUpdatedAt,
          });
          continue;
        }
      }

      await db
        .insert(tables.channel_members)
        .values({
          id: doc.id,
          channel_id: doc.channel_id,
          member_id: doc.member_id,
          last_read_at: doc.last_read_at ? new Date(doc.last_read_at) : null,
          created_at: new Date(doc.created_at),
          updated_at: new Date(doc.updated_at),
        })
        .onConflictDoUpdate({
          target: tables.channel_members.id,
          set: {
            channel_id: doc.channel_id,
            member_id: doc.member_id,
            last_read_at: doc.last_read_at ? new Date(doc.last_read_at) : null,
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
