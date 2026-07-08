import { and, desc, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const { userId } = event.context.params as { userId: string };
    const workspaces = await db
      .select({
        id: tables.workspace.id,
        name: tables.workspace.name,
        imageUrl: tables.workspace.image_url,
        inviteCode: tables.workspace.invite_code,
        userRole: tables.workspace_members.role,
        createdAt: tables.workspace.created_at,
        updatedAt: tables.workspace.updated_at,
      })
      .from(tables.workspace)
      .innerJoin(
        tables.workspace_members,
        and(
          eq(tables.workspace_members.workspace_id, tables.workspace.id),
          eq(tables.workspace_members.user_id, userId),
        ),
      )
      .orderBy(desc(tables.workspace.created_at));
    return workspaces;
  } catch (error: any) {
    throw createError({
      message: error.message,
      statusCode: error.statusCode ? error.statusCode : 500,
    });
  }
});
