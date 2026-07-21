import { and, eq } from "drizzle-orm";
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

    const session = await requireUserSession(event);

    const [workspace] = await db
      .select({
        id: tables.workspace.id,
        name: tables.workspace.name,
        imageUrl: tables.workspace.image_url,
        inviteCode: tables.workspace.invite_code,
        createdAt: tables.workspace.created_at,
        updatedAt: tables.workspace.updated_at,
        userId: tables.workspace.user_id,
        userRole: tables.workspace_members.role,
      })
      .from(tables.workspace)
      .innerJoin(
        tables.workspace_members,
        and(
          eq(tables.workspace_members.workspace_id, tables.workspace.id),
          eq(tables.workspace_members.user_id, session.user.id),
        ),
      )
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
