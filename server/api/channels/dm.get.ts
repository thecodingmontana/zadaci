import { and, eq, inArray, sql } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { CHANNEL_TYPE } from "~~/server/database/enums";
import { generateNanoId } from "~~/server/database/utils";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const userId = session.user.id;

    const query = getQuery(event);
    const workspaceId = query.workspace_id as string;
    const targetUserId = query.targetUserId as string;

    if (!workspaceId || !targetUserId) {
      throw createError({
        statusCode: 400,
        statusMessage: "workspace_id and targetUserId are required",
      });
    }

    const [currentMember, targetMember] = await Promise.all([
      db.query.workspace_members.findFirst({
        where: { user_id: userId, workspace_id: workspaceId },
      }),
      db.query.workspace_members.findFirst({
        where: { user_id: targetUserId, workspace_id: workspaceId },
      }),
    ]);

    if (!currentMember) {
      throw createError({ statusCode: 403, statusMessage: "Access denied" });
    }
    if (!targetMember) {
      throw createError({
        statusCode: 404,
        statusMessage: "User is not a member of this workspace",
      });
    }

    // Find existing DM channel where both members are the only two members
    const channelsWithCurrent = await db
      .select({ channel_id: tables.channel_members.channel_id })
      .from(tables.channel_members)
      .where(eq(tables.channel_members.member_id, currentMember.id));

    if (channelsWithCurrent.length > 0) {
      const channelIds = channelsWithCurrent.map((c) => c.channel_id);

      const dmCandidates = await db
        .select({
          channelId: tables.channel.id,
          memberCount: sql<number>`count(${tables.channel_members.id})::int`,
          hasTarget: sql<boolean>`bool_or(${tables.channel_members.member_id} = ${targetMember.id})`,
        })
        .from(tables.channel)
        .innerJoin(tables.channel_members, eq(tables.channel_members.channel_id, tables.channel.id))
        .where(
          and(
            eq(tables.channel.workspace_id, workspaceId),
            eq(tables.channel.type, CHANNEL_TYPE.DM),
            inArray(tables.channel.id, channelIds),
            sql`${tables.channel.deleted_at} IS NULL`,
          ),
        )
        .groupBy(tables.channel.id);

      const existing = dmCandidates.find((c) => c.memberCount === 2 && c.hasTarget);
      if (existing) {
        return { channelId: existing.channelId };
      }
    }

    // Create new DM channel
    const channelId = generateNanoId();
    const cm1Id = generateNanoId();
    const cm2Id = generateNanoId();
    const now = new Date();

    await db.insert(tables.channel).values({
      id: channelId,
      workspace_id: workspaceId,
      name: null,
      type: CHANNEL_TYPE.DM,
      created_by: userId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });

    await db.insert(tables.channel_members).values([
      {
        id: cm1Id,
        channel_id: channelId,
        member_id: currentMember.id,
        created_at: now,
        updated_at: now,
      },
      {
        id: cm2Id,
        channel_id: channelId,
        member_id: targetMember.id,
        created_at: now,
        updated_at: now,
      },
    ]);

    return { channelId };
  } catch (error: any) {
    if (error?.statusCode) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to find/create DM channel: ${error.message || "Unknown error"}`,
    });
  }
});
