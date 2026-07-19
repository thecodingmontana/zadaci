import { inArray } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface PushRow {
  assumedMasterState: {
    id: string;
    updated_at: string;
  } | null;
  newDocumentState: {
    id: string;
    message_id: string;
    member_id: string;
    status: "delivered" | "seen";
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
    const channelId = query.channel_id as string | undefined;
    if (!channelId) {
      throw createError({ statusCode: 400, statusMessage: "channel_id is required" });
    }

    const channel = await db.query.channel.findFirst({
      where: { id: channelId },
      with: { workspace: true },
    });
    if (!channel) {
      throw createError({ statusCode: 404, statusMessage: "Channel not found" });
    }

    const membership = await db.query.workspace_members.findFirst({
      where: { user_id: userId, workspace_id: channel.workspace_id },
    });
    if (!membership) {
      throw createError({ statusCode: 403, statusMessage: "Access denied" });
    }

    const receiptIds = body.map((row) => row.newDocumentState.id);
    const existingReceipts = await db
      .select({
        id: tables.message_receipt.id,
        updated_at: tables.message_receipt.updated_at,
      })
      .from(tables.message_receipt)
      .where(inArray(tables.message_receipt.id, receiptIds));

    const existingMap = new Map(existingReceipts.map((r) => [r.id, r]));

    for (const row of body) {
      const doc = row.newDocumentState;
      const existing = existingMap.get(doc.id);

      if (existing) {
        const assumedUpdatedAt = row.assumedMasterState?.updated_at;
        const currentUpdatedAt = existing.updated_at.toISOString();

        if (assumedUpdatedAt && assumedUpdatedAt !== currentUpdatedAt) {
          continue;
        }
      }

      await db
        .insert(tables.message_receipt)
        .values({
          id: doc.id,
          message_id: doc.message_id,
          member_id: doc.member_id,
          status: doc.status,
          created_at: new Date(doc.created_at),
          updated_at: new Date(doc.updated_at),
        })
        .onConflictDoUpdate({
          target: tables.message_receipt.id,
          set: {
            status: doc.status,
            updated_at: new Date(doc.updated_at),
          },
        });
    }

    return [];
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
