import { faker } from "@faker-js/faker";
import { and, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { sendWorkspaceWelcomeMail } from "~~/server/libs/emails/actions/workspace-welcome";
import { encryptString } from "~~/server/libs/encryption";
import { generateRandomRecoveryCode } from "~~/server/libs/utils";
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
        statusMessage: `Workspace not found for invite code: ${inviteCode}`,
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
    const recoveryCode = generateRandomRecoveryCode();
    const encryptedRecoveryCode = encryptString(recoveryCode);
    const serializedRecoveryCode = Buffer.from(encryptedRecoveryCode).toString("base64");
    const existingUser = await db.query.user.findFirst({
      where: { email },
    });
    if (!existingUser) {
      const [newUser] = await db
        .insert(tables.user)
        .values({
          email,
          recovery_code: serializedRecoveryCode,
          username: `${faker.person.firstName()} ${faker.person.lastName()}`,
          email_verified: false,
          profile_picture_url: `https://avatar.vercel.sh/${email}`,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning();

      if (!newUser) {
        throw createError({
          statusCode: 500,
          statusMessage: "Failed to create user!",
        });
      }

      await db
        .insert(tables.workspace_members)
        .values({
          role: invite.role,
          workspace_id: workspace.id,
          user_id: newUser.id,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning();
    } else {
      await db
        .insert(tables.workspace_members)
        .values({
          role: invite.role,
          workspace_id: workspace.id,
          user_id: existingUser.id,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning();
    }
    await db
      .delete(tables.workspace_invite_request)
      .where(
        and(
          eq(tables.workspace_invite_request.email, email),
          eq(tables.workspace_invite_request.workspace_id, workspace.id),
        ),
      );
    const message = existingUser
      ? `You've been successfully added to ${workspace.name ? `${workspace.name} workspace` : "a workspace"}.`
      : `You've been successfully added to ${workspace.name ? `${workspace.name} workspace` : "a workspace"}, and an account has been created for you.`;
    await sendWorkspaceWelcomeMail({
      email,
      link: `${process.env.NUXT_PUBLIC_SITE_URL}/workspace/${workspace.id}/dashboard`,
      workspace: workspace.name,
    });
    return {
      message,
    };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ?? 500,
      statusMessage: `${errorMessage}!`,
    });
  }
});
