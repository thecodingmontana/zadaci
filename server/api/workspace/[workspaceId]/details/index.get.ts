import { eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const workspaceId = getRouterParam(event, "workspaceId");

    if (!workspaceId || typeof workspaceId !== "string") {
      throw createError({
        statusCode: 400,
        statusMessage: "WorkspaceId is required!",
      });
    }

    const [workspace] = await db
      .select({
        id: tables.workspace.id,
        name: tables.workspace.name,
        imageUrl: tables.workspace.image_url,
        inviteCode: tables.workspace.invite_code,
        createdAt: tables.workspace.created_at,
        updatedAt: tables.workspace.updated_at,
        userId: tables.workspace.user_id,
      })
      .from(tables.workspace)
      .where(eq(tables.workspace.id, workspaceId));

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
