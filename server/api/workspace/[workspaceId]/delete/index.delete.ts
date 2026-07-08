import { eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { USER_ROLE } from "~~/server/database/enums";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const { name } = await readBody(event);
    const workspaceId = getRouterParam(event, "workspaceId");
    if (!session) {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    }
    if (!name || typeof name !== "string") {
      throw createError({ statusCode: 400, statusMessage: "Workspace name is required!" });
    }
    if (!workspaceId || typeof workspaceId !== "string") {
      throw createError({ statusCode: 400, statusMessage: "WorkspaceId is required!" });
    }
    const userWorkspace = await db.query.workspace_members.findFirst({
      where: {
        workspace_id: workspaceId,
        user_id: session.user.id,
      },
    });
    if (!userWorkspace || userWorkspace.role !== USER_ROLE.OWNER) {
      throw createError({ statusCode: 403, statusMessage: "Not authorized to delete workspace!" });
    }
    await db.delete(tables.workspace).where(eq(tables.workspace.id, workspaceId));
    const workspace = await db.query.workspace.findFirst({
      where: {
        members: {
          user_id: session.user.id,
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });
    return {
      workspace: workspace && {
        id: workspace.id,
        name: workspace.name,
        imageUrl: workspace.image_url,
        inviteCode: workspace.invite_code,
        userRole: userWorkspace.role,
        createdAt: workspace.created_at,
        updatedAt: workspace.updated_at,
      },
      message: `You've successfully deleted ${name} workspace!`,
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || "Internal server error",
    });
  }
});
