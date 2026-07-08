import { and, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { USER_ROLE } from "~~/server/database/enums";

interface ITeammate {
  id: string;
  role: "OWNER" | "MEMBER" | "GUEST";
}

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const { workspaceId } = event.context.params as { workspaceId: string };
    const { teammates } = (await readBody(event)) as { teammates: ITeammate[] };
    if (!session) {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    }
    if (!workspaceId || typeof workspaceId !== "string") {
      throw createError({ statusCode: 400, statusMessage: "WorkspaceId is required!" });
    }
    if (!Array.isArray(teammates) || teammates.length === 0) {
      throw createError({ statusCode: 400, statusMessage: "At least one teammate is required." });
    }
    const actor = await db.query.workspace_members.findFirst({
      where: {
        user_id: session.user.id,
        workspace_id: workspaceId,
      },
    });
    if (!actor || actor.role !== USER_ROLE.OWNER) {
      throw createError({
        statusMessage: "Only workspace owners can update teammate roles!",
        statusCode: 400,
      });
    }
    const teammateIds = teammates.map((t) => t.id);
    const existingRoles = await db.query.workspace_members.findMany({
      where: {
        user_id: { in: teammateIds },
        workspace_id: workspaceId,
      },
      columns: {
        user_id: true,
        role: true,
      },
    });
    const ownerBeingUpdated = existingRoles.find((t) => t.role === USER_ROLE.OWNER);
    if (ownerBeingUpdated) {
      throw createError({
        statusCode: 400,
        statusMessage: "You cannot update the role of an OWNER.",
      });
    }
    await Promise.all(
      teammates.map((teammate) => {
        if (teammate.role === "OWNER") {
          throw createError({
            statusCode: 400,
            statusMessage: "You cannot assign the OWNER role.",
          });
        }
        const roleValue = USER_ROLE[teammate.role as keyof typeof USER_ROLE];
        return db
          .update(tables.workspace_members)
          .set({ role: roleValue, updated_at: new Date() })
          .where(
            and(
              eq(tables.workspace_members.user_id, teammate.id),
              eq(tables.workspace_members.workspace_id, workspaceId),
            ),
          );
      }),
    );
    return {
      message: `Successfully updated roles for ${teammates.length} teammate${teammates.length > 1 ? "s" : ""}.`,
    };
  } catch (error: any) {
    const errorMessage = error ? error.statusMessage : error.message;
    throw createError({
      statusMessage: errorMessage,
      statusCode: error.statusCode ? error.statusCode : 500,
    });
  }
});
