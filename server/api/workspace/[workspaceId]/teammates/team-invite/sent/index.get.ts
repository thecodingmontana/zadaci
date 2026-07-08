import { db } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const { workspaceId } = event.context.params as { workspaceId: string };
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
    const workspace = await db.query.workspace.findFirst({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw createError({
        statusCode: 400,
        statusMessage: "Workspace not found!",
      });
    }
    const invites = await db.query.workspace_invite_request.findMany({
      where: { workspace_id: workspaceId },
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            email: true,
            profile_picture_url: true,
          },
        },
      },
    });
    return invites;
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      statusMessage: `${errorMessage}!`,
    });
  }
});
