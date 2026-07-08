import { render } from "@vue-email/render";
import { resend } from "~~/server/libs/resend";
import WorkspaceDecline from "../templates/workspace-decline.vue";

interface TeamInviteEmailProps {
  email: string;
  workspace: string;
  supportLink: string;
}

export async function sendWorkspaceDeclineMail({
  email,
  workspace,
  supportLink,
}: TeamInviteEmailProps) {
  try {
    const html = await render(
      WorkspaceDecline,
      {
        workspace,
        supportLink,
      },
      {
        pretty: true,
      },
    );

    await resend.emails.send({
      from: "Team Zadaci <onboarding@resend.dev>",
      to: [email],
      subject: `❌ Invite Declined for ${workspace} workspace.`,
      html,
    });
  } catch (error: any) {
    throw new Error(error.message);
  }
}
