import { eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { USER_ROLE } from "~~/server/database/enums";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const { image, name } = await readBody(event);
    const workspaceId = getRouterParam(event, "workspaceId");

    if (!session) {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    }

    if (!image || typeof image !== "string") {
      throw createError({ statusCode: 400, statusMessage: "Workspace image is required!" });
    }

    if (!name || typeof name !== "string") {
      throw createError({ statusCode: 400, statusMessage: "Workspace name is required!" });
    }

    if (!workspaceId || typeof workspaceId !== "string") {
      throw createError({ statusCode: 400, statusMessage: "Workspace ID is required!" });
    }

    const userWorkspace = await db.query.workspace_members.findFirst({
      where: {
        workspace_id: workspaceId,
        user_id: session.user.id,
      },
    });

    if (!userWorkspace || userWorkspace.role !== USER_ROLE.OWNER) {
      throw createError({ statusCode: 403, statusMessage: "Not authorized to update workspace!" });
    }

    const [updated] = await db
      .update(tables.workspace)
      .set({
        name,
        image_url: image,
        updated_at: new Date(),
      })
      .where(eq(tables.workspace.id, workspaceId))
      .returning();

    if (!updated) {
      throw createError({ statusCode: 500, statusMessage: "Failed to update workspace!" });
    }

    return {
      workspace: {
        id: updated.id,
        name: updated.name,
        imageUrl: updated.image_url,
        inviteCode: updated.invite_code,
        userRole: userWorkspace.role,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
      message: "You've successfully updated your workspace!",
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || "Internal server error",
    });
  }
});
