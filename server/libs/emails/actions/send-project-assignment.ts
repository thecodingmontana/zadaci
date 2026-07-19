import { render } from "@vue-email/render";
import { resend } from "~~/server/libs/resend";
import ProjectConfirmationMail from "../templates/project-confirmation-mail.vue";

interface Props {
  email: string;
  user: string;
  addedBy: string;
  project: string;
  workspace: string;
  link: string;
}

export async function sendProjectAssignmentEmail({
  email,
  user,
  addedBy,
  project,
  workspace,
  link,
}: Props) {
  try {
    const html = await render(
      ProjectConfirmationMail,
      {
        email,
        user,
        addedBy,
        project,
        workspace,
        link,
      },
      {
        pretty: true,
      },
    );

    await resend.emails.send({
      from: "Team Zadaci <noreply@thegoodslab.tech>",
      to: [email],
      subject: `You've been added to project "${project}" on ${workspace} workspace!`,
      html,
    });
    console.log(`[email] sendProjectAssignmentEmail to ${email} succeeded`);
  } catch (error: any) {
    console.error(`[email] sendProjectAssignmentEmail to ${email} failed:`, error.message);
  }
}
