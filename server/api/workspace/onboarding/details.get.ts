import { and, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const user = await db.query.user.findFirst({
      where: { id: session.user.id },
    });

    const [workspace] = await db
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
          eq(tables.workspace_members.user_id, session.user.id),
        ),
      );

    const result = {
      username: user ? user.username : "",
      profile_completed: Boolean(user?.password),
      workspace: workspace ?? null,
    };

    if (import.meta.dev) {
      console.warn("[onboarding/details]", {
        userId: session.user.id,
        profile_completed: result.profile_completed,
        has_workspace: Boolean(result.workspace),
      });
    }

    return result;
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      message: `${errorMessage}!`,
    });
  }
});
