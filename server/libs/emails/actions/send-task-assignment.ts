import { render } from "@vue-email/render";
import { resend } from "~~/server/libs/resend";
import TaskConfirmationMail from "../templates/task-confirmation-mail.vue";

interface Props {
  email: string;
  user: string;
  addedBy: string;
  project: string;
  workspace: string;
  link: string;
  task: string;
}

export async function sendTaskAssignmentEmail({
  email,
  user,
  addedBy,
  project,
  workspace,
  link,
  task,
}: Props) {
  try {
    const html = await render(
      TaskConfirmationMail,
      {
        email,
        user,
        addedBy,
        project,
        workspace,
        link,
        task,
      },
      {
        pretty: true,
      },
    );

    await resend.emails.send({
      from: "Team Zadaci <noreply@thegoodslab.tech>",
      to: [email],
      subject: `You’ve been assigned to the task in the ${workspace} workspace!`,
      html,
    });
    console.log(`[email] sendTaskAssignmentEmail to ${email} succeeded`);
  } catch (error: any) {
    console.error(`[email] sendTaskAssignmentEmail to ${email} failed:`, error.message);
  }
}
