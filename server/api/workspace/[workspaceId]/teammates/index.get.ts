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
    const existingWorkspace = await db.query.workspace.findFirst({
      where: { id: workspaceId },
    });
    if (!existingWorkspace) {
      throw createError({
        statusCode: 400,
        statusMessage: "Workspace not found!",
      });
    }
    const workspace = await db.query.workspace.findFirst({
      where: { id: workspaceId },
      with: {
        members: {
          with: {
            user: {
              columns: {
                id: true,
                email: true,
                profile_picture_url: true,
                email_verified: true,
                username: true,
                registered_2fa: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });
    return workspace;
  } catch (error: any) {
    const errorMessage = error ? error.statusMessage : error.message;
    throw createError({
      statusMessage: errorMessage,
      statusCode: error.statusCode ? error.statusCode : 500,
    });
  }
});
