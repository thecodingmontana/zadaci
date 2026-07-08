import { addDays } from "date-fns";
import { eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { sendWorkspaceInvite } from "~~/server/libs/emails/actions/send-invite";

interface ResendTeammate {
  email: string;
  role: "OWNER" | "MANAGER" | "EMPLOYEE";
}

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const { workspaceId } = event.context.params as { workspaceId: string };
    const { teammates } = (await readBody(event)) as { teammates: ResendTeammate[] };
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
    if (!Array.isArray(teammates) || teammates.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "At least one teammate is required.",
      });
    }
    const workspace = await db.query.workspace.findFirst({
      where: { id: workspaceId },
      columns: { name: true, invite_code: true },
    });
    if (!workspace) {
      throw createError({
        statusCode: 404,
        statusMessage: "Workspace not found!",
      });
    }
    const failedEmails: string[] = [];
    await Promise.all(
      teammates.map(async ({ email }) => {
        const invite = await db.query.workspace_invite_request.findFirst({
          where: {
            workspace_id: workspaceId,
            email,
            status: "PENDING",
          },
        });
        if (!invite) {
          failedEmails.push(email);
          return;
        }
        const [result] = await db
          .update(tables.workspace_invite_request)
          .set({
            expires_at: addDays(new Date(), 7),
            updated_at: new Date(),
            status: "PENDING",
          })
          .where(eq(tables.workspace_invite_request.id, invite.id))
          .returning();

        if (!result) {
          failedEmails.push(email);
          return;
        }

        await sendWorkspaceInvite({
          email,
          workspace: workspace.name,
          link: `${process.env.NUXT_PUBLIC_SITE_URL}/invite/${workspace.invite_code}?email=${email}`,
          sender: session.user.username,
          expiryDate: result.expires_at.toDateString(),
        });
      }),
    );
    if (failedEmails.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `No pending invite found for: ${failedEmails.join(", ")}`,
      });
    }
    return {
      message: `Successfully resent invites to ${teammates.length} email${teammates.length > 1 ? "s" : ""}`,
    };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ?? 500,
      statusMessage: `${errorMessage}!`,
    });
  }
});
