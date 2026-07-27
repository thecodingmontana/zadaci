import { and, eq, ne } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const channelId = getRouterParam(event, "channelId");
    const body = await readBody(event);

    if (!channelId) {
      throw createError({ statusCode: 400, statusMessage: "Channel ID is required" });
    }

    const [channel] = await db
      .select({
        id: tables.channel.id,
        workspace_id: tables.channel.workspace_id,
        name: tables.channel.name,
        type: tables.channel.type,
        created_by: tables.channel.created_by,
        created_at: tables.channel.created_at,
        updated_at: tables.channel.updated_at,
        deleted_at: tables.channel.deleted_at,
      })
      .from(tables.channel)
      .where(and(eq(tables.channel.id, channelId)));

    if (!channel) {
      throw createError({ statusCode: 404, statusMessage: "Channel not found" });
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
        statusMessage: "Only owners and moderators can edit channels",
      });
    }

    const name = body.name?.trim();
    if (name) {
      const existing = await db
        .select({ id: tables.channel.id })
        .from(tables.channel)
        .where(
          and(
            eq(tables.channel.workspace_id, channel.workspace_id),
            eq(tables.channel.name, name),
            ne(tables.channel.id, channelId),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        throw createError({
          statusCode: 409,
          statusMessage: `A channel named "#${name}" already exists in this workspace`,
        });
      }
    }

    const [updated] = await db
      .update(tables.channel)
      .set({
        name: name || channel.name,
        type: body.type || channel.type,
        updated_at: new Date(),
      })
      .where(eq(tables.channel.id, channelId))
      .returning();

    return {
      channel: {
        id: updated.id,
        workspace_id: updated.workspace_id,
        name: updated.name,
        type: updated.type,
        created_by: updated.created_by,
        created_at: updated.created_at.toISOString(),
        updated_at: updated.updated_at.toISOString(),
        deleted_at: null,
      },
    };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: `Failed to update channel: ${errorMessage}`,
    });
  }
});
