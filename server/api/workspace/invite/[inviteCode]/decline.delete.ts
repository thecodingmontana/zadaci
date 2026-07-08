import { and, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { sendWorkspaceDeclineMail } from "~~/server/libs/emails/actions/workspace-decline";
import { isValidEmail } from "~~/server/libs/validations";

export default defineEventHandler(async (event) => {
  try {
    const inviteCode = getRouterParam(event, "inviteCode");
    const { email } = await readBody(event);
    if (!inviteCode || typeof inviteCode !== "string") {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing workspace inviteCode!",
      });
    }
    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      throw createError({
        message: "Invalid Email",
        statusCode: 400,
      });
    }
    const workspace = await db.query.workspace.findFirst({
      where: { invite_code: inviteCode },
    });
    if (!workspace) {
      throw createError({
        statusCode: 400,
        statusMessage: `Workspace not found for invite: ${email}`,
      });
    }
    const invite = await db.query.workspace_invite_request.findFirst({
      where: {
        email,
        workspace_id: workspace.id,
      },
    });
    if (!invite) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invite not found for ${email}.`,
      });
    }
    await db
      .delete(tables.workspace_invite_request)
      .where(
        and(
          eq(tables.workspace_invite_request.email, email),
          eq(tables.workspace_invite_request.workspace_id, workspace.id),
        ),
      );
    await sendWorkspaceDeclineMail({
      workspace: workspace.name,
      supportLink: `mailto:thecodingmontana@gmail.com`,
      email,
    });
    return {
      message: `You've successfully declined the invite to join ${workspace.name ? `${workspace.name} workspace.` : "a workspace."}`,
    };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ?? 500,
      statusMessage: `${errorMessage}!`,
    });
  }
});
