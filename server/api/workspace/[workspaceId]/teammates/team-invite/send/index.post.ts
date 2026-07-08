import type { UserRole } from "~~/shared/types";
import { addDays } from "date-fns";
import { db, tables } from "~~/server/database/db";
import { USER_ROLE } from "~~/server/database/enums";
import { sendWorkspaceInvite } from "~~/server/libs/emails/actions/send-invite";
import { isValidEmail } from "~~/server/libs/validations";

interface ITeammate {
  email: string;
  role: UserRole;
}

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const { workspaceId } = event.context.params as { workspaceId: string };
    const { teammates } = (await readBody(event)) as { teammates: ITeammate[] };

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

    if (!teammates || !Array.isArray(teammates) || teammates.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "At least one teammate is required to send invite.",
      });
    }

    const invalidEmails = teammates.filter((teammate) => !isValidEmail(teammate.email));

    if (invalidEmails.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid email format for: ${invalidEmails.map((t) => t.email).join(", ")}`,
      });
    }

    const workspace = await db.query.workspace.findFirst({
      where: { id: workspaceId },
      columns: {
        id: true,
        name: true,
        invite_code: true,
        image_url: true,
      },
    });

    if (!workspace) {
      throw createError({
        statusCode: 400,
        statusMessage: "Workspace not found!",
      });
    }

    const existingTeammateEmails = await Promise.all(
      teammates.map(async (invite) => {
        const user = await db.query.user.findFirst({
          where: { email: invite.email },
          columns: { id: true },
        });

        if (!user) return { email: invite.email, exists: false };

        const teammate = await db.query.workspace_members.findFirst({
          where: {
            workspace_id: workspaceId,
            user_id: user.id,
          },
        });

        return {
          email: invite.email,
          exists: !!teammate,
        };
      }),
    );

    const teammateAlreadyExists = existingTeammateEmails
      .filter((result) => result.exists)
      .map((result) => result.email);

    if (teammateAlreadyExists.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `The following emails are already in the workspace: ${teammateAlreadyExists.join(", ")}`,
      });
    }

    const existingInvites = await Promise.all(
      teammates.map(async (teammate) => {
        const invite = await db.query.workspace_invite_request.findFirst({
          where: {
            workspace_id: workspaceId,
            email: teammate.email,
            status: "PENDING",
          },
        });

        return {
          email: teammate.email,
          exists: !!invite,
        };
      }),
    );

    const alreadyInvited = existingInvites
      .filter((result) => result.exists)
      .map((result) => result.email);

    if (alreadyInvited.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `The following emails already have pending invites: ${alreadyInvited.join(", ")}`,
      });
    }

    await Promise.all(
      teammates.map(async (teammate) => {
        const roleValue = USER_ROLE[teammate.role as keyof typeof USER_ROLE];

        const [result] = await db
          .insert(tables.workspace_invite_request)
          .values({
            email: teammate.email,
            workspace_id: workspaceId,
            status: "PENDING",
            invited_by: session.user.id,
            expires_at: addDays(new Date(), 7),
            role: roleValue,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning();

        if (!result) {
          throw createError({
            statusCode: 500,
            statusMessage: `Failed to create invite for ${teammate.email}`,
          });
        }

        await sendWorkspaceInvite({
          email: teammate.email,
          workspace: workspace.name,
          link: `${process.env.NUXT_PUBLIC_SITE_URL}/invite/${workspace.invite_code}?email=${teammate.email}`,
          sender: session.user.username,
          expiryDate: result.expires_at.toDateString(),
        });
      }),
    );

    return {
      message: `Successfully sent invites to ${teammates.length} email${teammates.length > 1 ? "s" : ""}`,
    };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ?? 500,
      statusMessage: `${errorMessage}!`,
    });
  }
});
