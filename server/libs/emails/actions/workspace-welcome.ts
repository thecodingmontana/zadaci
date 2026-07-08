import { render } from "@vue-email/render";
import { resend } from "~~/server/libs/resend";
import WorkspaceWelcome from "../templates/workspace-welcome.vue";

interface TeamInviteEmailProps {
  email: string;
  workspace: string;
  link: string;
}

export async function sendWorkspaceWelcomeMail({ email, link, workspace }: TeamInviteEmailProps) {
  try {
    const html = await render(
      WorkspaceWelcome,
      {
        link,
        workspace,
      },
      {
        pretty: true,
      },
    );

    await resend.emails.send({
      from: "Team Zadaci <onboarding@resend.dev>",
      to: [email],
      subject: `🎉 Welcome to ${workspace} workspace.`,
      html,
    });
  } catch (error: any) {
    throw new Error(error.message);
  }
}
