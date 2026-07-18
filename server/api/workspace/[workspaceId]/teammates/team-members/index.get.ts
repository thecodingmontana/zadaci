import { and, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const workspaceId = getRouterParam(event, "workspaceId");
    const query = getQuery(event);
    const teamId = query.team_id as string | undefined;

    if (!session) {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    }
    if (!workspaceId || typeof workspaceId !== "string") {
      throw createError({ statusCode: 400, statusMessage: "Workspace ID is required!" });
    }

    const existingWorkspace = await db.query.workspace.findFirst({
      where: { id: workspaceId },
    });
    if (!existingWorkspace) {
      throw createError({ statusCode: 400, statusMessage: "Workspace not found!" });
    }

    const conditions = [eq(tables.team.workspace_id, workspaceId)];
    if (teamId) {
      conditions.push(eq(tables.team_members.team_id, teamId));
    }

    const teamMembers = await db
      .select({
        id: tables.team_members.id,
        teamId: tables.team_members.team_id,
        memberId: tables.team_members.member_id,
        role: tables.workspace_members.role,
        userId: tables.workspace_members.user_id,
        email: tables.user.email,
        username: tables.user.username,
        avatar: tables.user.profile_picture_url,
      })
      .from(tables.team_members)
      .innerJoin(tables.team, eq(tables.team_members.team_id, tables.team.id))
      .innerJoin(
        tables.workspace_members,
        eq(tables.team_members.member_id, tables.workspace_members.id),
      )
      .innerJoin(tables.user, eq(tables.workspace_members.user_id, tables.user.id))
      .where(and(...conditions));

    return teamMembers;
  } catch (error: any) {
    const errorMessage = error?.statusMessage || error.message || "Unknown error";
    throw createError({
      statusMessage: errorMessage,
      statusCode: error.statusCode || 500,
    });
  }
});
