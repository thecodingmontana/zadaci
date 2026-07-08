import { db } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const workspaceId = getRouterParam(event, "workspaceId");

    if (!workspaceId || typeof workspaceId !== "string") {
      throw createError({
        statusCode: 400,
        statusMessage: "WorkspaceId is required!",
      });
    }

    // Check if workspace exists
    const workspace = await db.query.workspace.findFirst({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw createError({
        statusCode: 400,
        statusMessage: "Workspace not found!",
      });
    }

    return workspace;
  } catch (error: any) {
    const errorMessage = error ? error.statusMessage : error.message;
    throw createError({
      statusMessage: errorMessage,
      statusCode: error.statusCode ? error.statusCode : 500,
    });
  }
});
