import { db } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const workspaceId = getRouterParam(event, "workspaceId");

    if (!session) {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    }
    if (!workspaceId || typeof workspaceId !== "string") {
      throw createError({ statusCode: 400, statusMessage: "WorkspaceId is required!" });
    }

    const workspace = await db.query.workspace.findFirst({
      where: { id: workspaceId },
      with: {
        members: {
          with: {
            user: {
              with: {
                user_status: true,
              },
              columns: {
                id: true,
                email: true,
                username: true,
                profile_picture_url: true,
              },
            },
          },
        },
      },
    });

    if (!workspace) {
      throw createError({ statusCode: 404, statusMessage: "Workspace not found!" });
    }

    const userStatuses = workspace.members.map((member) => member.user.user_status).filter(Boolean);

    return userStatuses;
  } catch (error: any) {
    const errorMessage = error?.statusMessage || error.message || "Unknown error";
    throw createError({
      statusMessage: errorMessage,
      statusCode: error.statusCode || 500,
    });
  }
});
