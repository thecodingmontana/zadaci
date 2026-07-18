import { and, eq, inArray } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { USER_ROLE } from "~~/server/database/enums";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const { userIds, workspaceId } = (await readBody(event)) as {
      userIds: string[];
      workspaceId: string;
    };
    if (
      !workspaceId ||
      !Array.isArray(userIds) ||
      userIds.length === 0 ||
      userIds.some((id) => typeof id !== "string")
    ) {
      throw createError({
        statusMessage: "WorkspaceId and a valid userIds array are required.",
      });
    }
    const actor = await db.query.workspace_members.findFirst({
      where: {
        user_id: session.user.id,
        workspace_id: workspaceId,
      },
    });
    if (!actor || (actor.role !== USER_ROLE.OWNER && actor.role !== USER_ROLE.MODERATOR)) {
      throw createError({
        statusMessage: "Only workspace owners and moderators can remove teammates!",
      });
    }
    const removableUsers = await db.query.workspace_members.findMany({
      where: {
        user_id: { in: userIds },
        workspace_id: workspaceId,
        role: { ne: USER_ROLE.OWNER },
      },
      columns: {
        user_id: true,
      },
    });
    const idsToDelete = removableUsers.map((u) => u.user_id);
    if (idsToDelete.length === 0) {
      throw createError({
        statusMessage: "No removable teammates found (OWNERs cannot be removed).",
      });
    }
    await db
      .delete(tables.workspace_members)
      .where(
        and(
          inArray(tables.workspace_members.user_id, idsToDelete),
          eq(tables.workspace_members.workspace_id, workspaceId),
        ),
      );
    return {
      message: `Successfully removed ${idsToDelete.length} teammate${idsToDelete.length > 1 ? "s" : ""} from the workspace.`,
    };
  } catch (error: any) {
    const errorMessage = error ? error.statusMessage : error.message;
    throw createError({
      statusMessage: errorMessage,
      statusCode: error.statusCode ? error.statusCode : 500,
    });
  }
});
