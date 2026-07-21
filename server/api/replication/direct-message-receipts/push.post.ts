import { inArray } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface PushRow {
  assumedMasterState: { id: string; updated_at: string } | null;
  newDocumentState: {
    id: string;
    direct_message_id: string;
    member_id: string;
    status: string;
    created_at: string;
    updated_at: string;
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

    const invalidMember = body.filter((row) => row.newDocumentState.member_id !== membership.id);
    if (invalidMember.length > 0) {
      throw createError({
        statusCode: 403,
        statusMessage: "Cannot modify receipts for another member",
      });
    }

    const ids = body.map((r) => r.newDocumentState.id);
    const existing = await db
      .select({
        id: tables.direct_message_receipt.id,
        updated_at: tables.direct_message_receipt.updated_at,
      })
      .from(tables.direct_message_receipt)
      .where(inArray(tables.direct_message_receipt.id, ids));

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
          conflicts.push(doc);
          continue;
        }
      }

      await db
        .insert(tables.direct_message_receipt)
        .values({
          id: doc.id,
          direct_message_id: doc.direct_message_id,
          member_id: doc.member_id,
          status: doc.status,
          created_at: new Date(doc.created_at),
          updated_at: new Date(doc.updated_at),
        })
        .onConflictDoUpdate({
          target: tables.direct_message_receipt.id,
          set: { status: doc.status, updated_at: new Date(doc.updated_at) },
        });
    }

    return conflicts;
  } catch (error: any) {
    if (error?.statusCode) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: `DM receipt push failed: ${error.message || "Unknown error"}`,
    });
  }
});
