import { eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const workspaceId = getRouterParam(event, "workspaceId");
    const projectId = getRouterParam(event, "projectId");
    if (!session) {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    }
    if (!workspaceId || typeof workspaceId !== "string") {
      throw createError({ statusCode: 400, statusMessage: "Workspace ID is required!" });
    }
    if (!projectId || typeof projectId !== "string") {
      throw createError({ statusCode: 400, statusMessage: "Project ID is required!" });
    }
    const project = await db.query.project.findFirst({
      where: {
        id: projectId,
        workspace_id: workspaceId,
      },
    });
    if (!project) {
      throw createError({ statusCode: 400, statusMessage: "Invalid project!" });
    }
    const projectMembers = await db
      .select({
        email: tables.user.email,
        avatar: tables.user.profile_picture_url,
        username: tables.user.username,
        member_id: tables.workspace_members.id,
      })
      .from(tables.project_members)
      .innerJoin(
        tables.workspace_members,
        eq(tables.project_members.member_id, tables.workspace_members.id),
      )
      .innerJoin(tables.user, eq(tables.user.id, tables.workspace_members.user_id))
      .where(eq(tables.project_members.project_id, projectId));
    return projectMembers;
  } catch (error: any) {
    const errorMessage = error?.statusMessage || error.message || "Unknown error";
    throw createError({
      statusMessage: errorMessage,
      statusCode: error.statusCode || 500,
    });
  }
});
