import { and, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const channelId = getRouterParam(event, "channelId");

    if (!channelId) {
      throw createError({ statusCode: 400, statusMessage: "Channel ID is required" });
    }

    const [channel] = await db
      .select({
        id: tables.channel.id,
        workspace_id: tables.channel.workspace_id,
        name: tables.channel.name,
      })
      .from(tables.channel)
      .where(and(eq(tables.channel.id, channelId)));

    if (!channel) {
      throw createError({ statusCode: 404, statusMessage: "Channel not found" });
    }

    if (channel.name.toLowerCase() === "general") {
      throw createError({
        statusCode: 403,
        statusMessage: "The #general channel cannot be deleted",
      });
    }

    const [membership] = await db
      .select({ id: tables.workspace_members.id, role: tables.workspace_members.role })
      .from(tables.workspace_members)
      .where(
        and(
          eq(tables.workspace_members.workspace_id, channel.workspace_id),
          eq(tables.workspace_members.user_id, session.user.id),
        ),
      )
      .limit(1);

    if (!membership || (membership.role !== "owner" && membership.role !== "moderator")) {
      throw createError({
        statusCode: 403,
        statusMessage: "Only owners and moderators can delete channels",
      });
    }

    await db
      .update(tables.channel)
      .set({ deleted_at: new Date(), updated_at: new Date() })
      .where(eq(tables.channel.id, channelId));

    await db
      .update(tables.channel_members)
      .set({ updated_at: new Date() })
      .where(eq(tables.channel_members.channel_id, channelId));

    return { success: true };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: `Failed to delete channel: ${errorMessage}`,
    });
  }
});
