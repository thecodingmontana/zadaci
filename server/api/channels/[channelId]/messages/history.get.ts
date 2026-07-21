import { and, desc, eq, lt } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const userId = session.user.id;

    const channelId = getRouterParam(event, "channelId");
    if (!channelId) throw createError({ statusCode: 400, statusMessage: "channelId is required" });

    const query = getQuery(event);
    const before = query.before as string | undefined;
    const limit = Math.min(Number(query.limit) || 50, 100);

    const channel = await db.query.channel.findFirst({
      where: { id: channelId },
      with: { workspace: true },
    });
    if (!channel) throw createError({ statusCode: 404, statusMessage: "Channel not found" });

    const membership = await db.query.workspace_members.findFirst({
      where: { user_id: userId, workspace_id: channel.workspace_id },
    });
    if (!membership) throw createError({ statusCode: 403, statusMessage: "Access denied" });

    const channelMembership = await db.query.channel_members.findFirst({
      where: { channel_id: channelId, member_id: membership.id },
    });
    if (!channelMembership && channel.type !== "public") {
      throw createError({ statusCode: 403, statusMessage: "Not a channel member" });
    }

    const conditions = [eq(tables.message.channel_id, channelId)];

    if (before) {
      conditions.push(lt(tables.message.created_at, new Date(before)));
    }

    const rows = await db
      .select()
      .from(tables.message)
      .where(and(...conditions))
      .orderBy(desc(tables.message.created_at))
      .limit(limit);

    const messages = rows.reverse().map((row) => ({
      id: row.id,
      channel_id: row.channel_id,
      author_id: row.author_id,
      content: row.content,
      edited_at: row.edited_at ? row.edited_at.toISOString() : null,
      reactions: row.reactions as { emoji: string; member_ids: string[] }[],
      parent_message_id: row.parent_message_id,
      thread_reply_count: row.thread_reply_count,
      thread_participant_ids: row.thread_participant_ids as string[],
      thread_last_reply_at: row.thread_last_reply_at
        ? row.thread_last_reply_at.toISOString()
        : null,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
      deleted_at: row.deleted_at ? row.deleted_at.toISOString() : null,
    }));

    const nextCursor =
      rows.length === limit && rows.length > 0 && rows[0] ? rows[0].created_at.toISOString() : null;

    return { messages, nextCursor };
  } catch (error: any) {
    if (error?.statusCode) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: `History fetch failed: ${error.message || "Unknown error"}`,
    });
  }
});
