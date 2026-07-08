import { and, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { isValidEmail } from "~~/server/libs/validations";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const { workspaceId } = event.context.params as { workspaceId: string };
    const { invites } = (await readBody(event)) as {
      invites: { email: string; inviteCode: string }[];
    };
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
    if (!Array.isArray(invites) || invites.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "At least one invite is required.",
      });
    }
    const messages: string[] = [];
    for (const { email, inviteCode } of invites) {
      if (!email || typeof email !== "string" || !isValidEmail(email)) {
        throw createError({
          statusCode: 400,
          statusMessage: `Invalid email: ${email}`,
        });
      }
      if (!inviteCode || typeof inviteCode !== "string") {
        throw createError({
          statusCode: 400,
          statusMessage: "Invite code is required.",
        });
      }
      const invite = await db.query.workspace_invite_request.findFirst({
        where: {
          email,
          workspace_id: workspaceId,
        },
      });
      if (!invite) {
        throw createError({
          statusCode: 400,
          statusMessage: `Invite not found for ${email}.`,
        });
      }
      if (invite.email !== session.user.email) {
        throw createError({
          statusCode: 403,
          statusMessage: `You are not authorized to decline invite for ${email}.`,
        });
      }
      const workspace = await db.query.workspace.findFirst({
        where: {
          invite_code: inviteCode,
          id: invite.workspace_id,
        },
      });
      if (!workspace) {
        throw createError({
          statusCode: 400,
          statusMessage: `Workspace not found for invite: ${email}`,
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
      messages.push(
        `You've successfully declined the invite to join ${workspace.name ? `${workspace.name} workspace.` : "a workspace."}`,
      );
    }
    return {
      message: messages.join(", "),
    };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ?? 500,
      statusMessage: `${errorMessage}!`,
    });
  }
});
