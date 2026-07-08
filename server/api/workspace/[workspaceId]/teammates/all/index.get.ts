import { eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

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
    const teammates = await db
      .select({
        email: tables.user.email,
        avatar: tables.user.profile_picture_url,
        username: tables.user.username,
        user_id: tables.user.id,
        member_id: tables.workspace_members.id,
      })
      .from(tables.workspace_members)
      .innerJoin(tables.user, eq(tables.user.id, tables.workspace_members.user_id))
      .where(eq(tables.workspace_members.workspace_id, workspaceId));
    return teammates;
  } catch (error: any) {
    const errorMessage = error ? error.statusMessage : error.message;
    throw createError({
      statusMessage: errorMessage,
      statusCode: error.statusCode ? error.statusCode : 500,
    });
  }
});
