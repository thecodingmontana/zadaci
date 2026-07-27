import { and, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { CHANNEL_TYPE } from "~~/server/database/enums";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const body = await readBody(event);

    if (!body?.name || !body?.workspaceId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Channel name and workspace ID are required",
      });
    }

    const name = (body.name as string).trim();
    if (!name) {
      throw createError({
        statusCode: 400,
        statusMessage: "Channel name cannot be empty",
      });
    }
    if (name.toLowerCase() === "general") {
      throw createError({
        statusCode: 400,
        statusMessage: "Channel name cannot be 'general'",
      });
    }

    const type = body.type === "private" ? CHANNEL_TYPE.PRIVATE : CHANNEL_TYPE.PUBLIC;

    const existing = await db
      .select({ id: tables.channel.id })
      .from(tables.channel)
      .where(and(eq(tables.channel.workspace_id, body.workspaceId), eq(tables.channel.name, name)))
      .limit(1);

    if (existing.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: `A channel named "#${name}" already exists in this workspace`,
      });
    }

    const [workspaceMember] = await db
      .select({ id: tables.workspace_members.id })
      .from(tables.workspace_members)
      .where(
        and(
          eq(tables.workspace_members.workspace_id, body.workspaceId),
          eq(tables.workspace_members.user_id, session.user.id),
        ),
      )
      .limit(1);

    if (!workspaceMember) {
      throw createError({
        statusCode: 403,
        statusMessage: "You are not a member of this workspace",
      });
    }

    const [channel] = await db
      .insert(tables.channel)
      .values({
        workspace_id: body.workspaceId,
        name,
        type,
        created_by: session.user.id,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    if (!channel) {
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to create channel",
      });
    }

    const memberIds: string[] = [];

    if (type === CHANNEL_TYPE.PUBLIC) {
      const allMembers = await db
        .select({ id: tables.workspace_members.id })
        .from(tables.workspace_members)
        .where(eq(tables.workspace_members.workspace_id, body.workspaceId));

      if (allMembers.length > 0) {
        const memberRows = allMembers.map((m) => ({
          channel_id: channel.id,
          member_id: m.id,
          created_at: new Date(),
          updated_at: new Date(),
        }));
        await db.insert(tables.channel_members).values(memberRows);
        memberIds.push(...allMembers.map((m) => m.id));
      }
    } else {
      await db.insert(tables.channel_members).values({
        channel_id: channel.id,
        member_id: workspaceMember.id,
        created_at: new Date(),
        updated_at: new Date(),
      });
      memberIds.push(workspaceMember.id);
    }

    const config = useRuntimeConfig(event);
    const supabaseUrl = config.public.supabase.url as string;
    const anonKey = config.public.supabase.anonKey as string;
    try {
      await $fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
        method: "POST",
        headers: { apikey: anonKey, "Content-Type": "application/json" },
        body: {
          channel: "app_channel_realtime",
          event: "channel_created",
          payload: { channelId: channel.id },
        },
      });
    } catch {
      // broadcast is a non-critical optimisation — DB write already succeeded
    }

    return {
      channel: {
        id: channel.id,
        workspace_id: channel.workspace_id,
        name: channel.name,
        type: channel.type,
        created_by: channel.created_by,
        created_at: channel.created_at.toISOString(),
        updated_at: channel.updated_at.toISOString(),
        deleted_at: null,
      },
      members: memberIds,
    };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: `Failed to create channel: ${errorMessage}`,
    });
  }
});
