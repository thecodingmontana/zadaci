import { eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const { name } = await readBody(event);
    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized",
      });
    }
    if (typeof name !== "string" || !name) {
      throw createError({
        statusMessage: "Name is required!",
        statusCode: 400,
      });
    }
    if (session.user.username !== name) {
      throw createError({
        statusMessage: "Invalid name!",
        statusCode: 400,
      });
    }
    // Check if user exists
    const user = await db.query.user.findFirst({
      where: { id: session.user.id },
    });
    if (!user) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid user data!",
      });
    }
    // Find workspaces owned by the user
    const ownedWorkspaces = await db.query.workspace.findMany({
      where: { user_id: user.id },
    });
    // Delete owned workspaces
    if (ownedWorkspaces.length > 0) {
      await Promise.all(
        ownedWorkspaces.map((workspace) =>
          db.delete(tables.workspace).where(eq(tables.workspace.id, workspace.id)),
        ),
      );
    }
    // Remove user from team memberships
    await db.delete(tables.workspace_members).where(eq(tables.workspace_members.user_id, user.id));
    // Finally delete the user account
    await db.delete(tables.user).where(eq(tables.user.id, user.id));
    return {
      message: "You've successfully deleted your account!",
    };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      statusMessage: `Delete user account error: ${errorMessage}!`,
    });
  }
});
