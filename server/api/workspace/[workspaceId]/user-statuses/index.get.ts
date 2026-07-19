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

    const OFFLINE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes
    const now = Date.now();

    const userStatuses = workspace.members
      .map((member) => member.user.user_status)
      .filter(Boolean)
      .map((s) => {
        const lastSeen = s.updated_at ? new Date(s.updated_at).getTime() : 0;
        const effectiveStatus =
          s.status !== "offline" && now - lastSeen > OFFLINE_THRESHOLD_MS ? "offline" : s.status;
        return { ...s, status: effectiveStatus };
      });

    return userStatuses;
  } catch (error: any) {
    const errorMessage = error?.statusMessage || error.message || "Unknown error";
    throw createError({
      statusMessage: errorMessage,
      statusCode: error.statusCode || 500,
    });
  }
});
