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

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        throw createError({
          statusCode: 400,
          statusMessage: `Invite for ${email} has expired.`,
        });
      }

      if (invite.email !== session.user.email) {
        throw createError({
          statusCode: 403,
          statusMessage: `You are not authorized to accept invite for ${email}.`,
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

      const existing = await db.query.workspace_members.findFirst({
        where: {
          workspace_id: workspace.id,
          user_id: session.user.id,
        },
      });

      if (existing) {
        throw createError({
          statusCode: 400,
          statusMessage: `You are already a member of ${workspace.name}`,
        });
      }

      await db.insert(tables.workspace_members).values({
        user_id: session.user.id,
        workspace_id: workspace.id,
        role: invite.role,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await db
        .delete(tables.workspace_invite_request)
        .where(
          and(
            eq(tables.workspace_invite_request.id, invite.id),
            eq(tables.workspace_invite_request.workspace_id, workspace.id),
          ),
        );

      messages.push(`You've successfully joined the workspace ${workspace.name}`);
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
