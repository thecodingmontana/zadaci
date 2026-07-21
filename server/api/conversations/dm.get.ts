import { and, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const userId = session.user.id;

    const query = getQuery(event);
    const workspaceId = query.workspace_id as string | undefined;
    const targetUserId = query.targetUserId as string | undefined;

    if (!workspaceId || !targetUserId) {
      throw createError({
        statusCode: 400,
        statusMessage: "workspace_id and targetUserId are required",
      });
    }

    const [currentMember] = await db
      .select()
      .from(tables.workspace_members)
      .where(
        and(
          eq(tables.workspace_members.user_id, userId),
          eq(tables.workspace_members.workspace_id, workspaceId),
        ),
      )
      .limit(1);
    if (!currentMember) {
      throw createError({ statusCode: 403, statusMessage: "Access denied" });
    }

    const [targetMember] = await db
      .select()
      .from(tables.workspace_members)
      .where(
        and(
          eq(tables.workspace_members.user_id, targetUserId),
          eq(tables.workspace_members.workspace_id, workspaceId),
        ),
      )
      .limit(1);
    if (!targetMember) {
      throw createError({ statusCode: 404, statusMessage: "Target user not found in workspace" });
    }

    const [memberOneId, memberTwoId] = [currentMember.id, targetMember.id].sort();

    const [existing] = await db
      .select()
      .from(tables.conversation)
      .where(
        and(
          eq(tables.conversation.workspace_id, workspaceId),
          eq(tables.conversation.member_one_id, memberOneId),
          eq(tables.conversation.member_two_id, memberTwoId),
        ),
      )
      .limit(1);
    if (existing) {
      return { conversationId: existing.id };
    }

    const now = new Date();
    const [conversation] = await db
      .insert(tables.conversation)
      .values({
        workspace_id: workspaceId,
        member_one_id: memberOneId,
        member_two_id: memberTwoId,
        created_at: now,
        updated_at: now,
      })
      .returning({ id: tables.conversation.id });

    return { conversationId: conversation.id };
  } catch (error: any) {
    if (error?.statusCode) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to find/create DM conversation: ${error.message || "Unknown error"}`,
    });
  }
});
