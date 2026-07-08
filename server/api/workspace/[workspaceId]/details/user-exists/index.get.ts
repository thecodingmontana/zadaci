import { db } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const workspaceId = getRouterParam(event, "workspaceId");

    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized",
      });
    }

    if (!workspaceId || typeof workspaceId !== "string") {
      throw createError({
        statusCode: 400,
        statusMessage: "WorkspaceId is required!",
      });
    }

    // Check if user exists in the workspace
    const workspace = await db.query.workspace.findFirst({
      where: {
        id: workspaceId,
        members: {
          user_id: session.user.id,
        },
      },
      with: {
        members: true,
      },
    });

    return workspace;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || "Internal server error",
    });
  }
});
