import { and, eq, inArray } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { USER_ROLE } from "~~/server/database/enums";
import { requireWorkspaceMember } from "~~/server/libs/auth-helpers";

export default defineEventHandler(async (event) => {
  try {
    const { workspaceId } = event.context.params as { workspaceId: string };
    const { session } = await requireWorkspaceMember(event, workspaceId, [
      USER_ROLE.OWNER,
      USER_ROLE.MODERATOR,
    ]);
    const { emails } = (await readBody(event)) as { emails: string[] };
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
    if (!Array.isArray(emails) || emails.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "At least one email is required for removal.",
      });
    }
    await db
      .delete(tables.workspace_invite_request)
      .where(
        and(
          eq(tables.workspace_invite_request.workspace_id, workspaceId),
          inArray(tables.workspace_invite_request.email, emails),
        ),
      );
    return {
      message: `Successfully deleted ${emails.length} invite request${emails.length > 1 ? "s" : ""}.`,
    };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ?? 500,
      statusMessage: `${errorMessage}!`,
    });
  }
});
