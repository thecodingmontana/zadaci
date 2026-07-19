import { render } from "@vue-email/render";
import { resend } from "~~/server/libs/resend";
import WorkspaceInvite from "../templates/workspace-invite.vue";

interface TeamInviteEmailProps {
  email: string;
  sender: string;
  workspace: string;
  link: string;
  expiryDate: string;
}

export async function sendWorkspaceInvite({
  email,
  link,
  sender,
  workspace,
  expiryDate,
}: TeamInviteEmailProps) {
  try {
    const html = await render(
      WorkspaceInvite,
      {
        link,
        sender,
        workspace,
        expiryDate,
      },
      {
        pretty: true,
      },
    );

    await resend.emails.send({
      from: "Team Zadaci <noreply@thegoodslab.tech>",
      to: [email],
      subject: `You've been invited to work together in ${workspace} workspace.`,
      html,
    });
    console.log(`[email] sendWorkspaceInvite to ${email} succeeded`);
  } catch (error: any) {
    console.error(`[email] sendWorkspaceInvite to ${email} failed:`, error.message);
  }
}
