import { faker } from "@faker-js/faker";
import { and, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { CHANNEL_TYPE } from "~~/server/database/enums";
import { sendWorkspaceWelcomeMail } from "~~/server/libs/emails/actions/workspace-welcome";
import { encryptString } from "~~/server/libs/encryption";
import { generateRandomRecoveryCode } from "~~/server/libs/utils";
import { isValidEmail } from "~~/server/libs/validations";

export default defineEventHandler(async (event) => {
  try {
    const inviteCode = getRouterParam(event, "inviteCode");
    const { email, token } = await readBody(event);
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
    if (!token || typeof token !== "string") {
      throw createError({ statusCode: 400, statusMessage: "Invalid invite link" });
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
        id: token,
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
    if (invite.expires_at < new Date()) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invite for ${email} has expired. Kindly request a new invite.`,
      });
    }
    let existingUser = await db.query.user.findFirst({
      where: { email },
    });
    const isNewUser = !existingUser;
    if (!existingUser) {
      const recoveryCode = generateRandomRecoveryCode();
      const encryptedRecoveryCode = encryptString(recoveryCode);
      const serializedRecoveryCode = Buffer.from(encryptedRecoveryCode).toString("base64");
      [existingUser] = await db
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

      if (!existingUser) {
        throw createError({
          statusCode: 500,
          statusMessage: "Failed to create user!",
        });
      }
    }
    const alreadyMember = await db.query.workspace_members.findFirst({
      where: { workspace_id: workspace.id, user_id: existingUser.id },
      columns: { id: true },
    });
    if (!alreadyMember) {
      const [newMember] = await db
        .insert(tables.workspace_members)
        .values({
          role: invite.role,
          workspace_id: workspace.id,
          user_id: existingUser.id,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning();

      const publicChannels = await db
        .select({ id: tables.channel.id })
        .from(tables.channel)
        .where(
          and(
            eq(tables.channel.workspace_id, workspace.id),
            eq(tables.channel.type, CHANNEL_TYPE.PUBLIC),
          ),
        );

      if (publicChannels.length > 0) {
        await db.insert(tables.channel_members).values(
          publicChannels.map((ch) => ({
            channel_id: ch.id,
            member_id: newMember.id,
            created_at: new Date(),
            updated_at: new Date(),
          })),
        );
      }
    }
    await db
      .delete(tables.workspace_invite_request)
      .where(
        and(
          eq(tables.workspace_invite_request.email, email),
          eq(tables.workspace_invite_request.workspace_id, workspace.id),
        ),
      );
    const message = !isNewUser
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
