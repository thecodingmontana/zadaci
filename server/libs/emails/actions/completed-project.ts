import { render } from "@vue-email/render";
import { resend } from "~~/server/libs/resend";
import CompletedProjectMail from "../templates/completed-project-mail.vue";

interface ProjectCompletionMailProps {
  email: string;
  user: string;
  project: string;
  workspace: string;
  completedBy: string;
  link: string;
}

export async function sendProjectCompletionMail({
  email,
  workspace,
  user,
  project,
  completedBy,
  link,
}: ProjectCompletionMailProps) {
  try {
    const html = await render(
      CompletedProjectMail,
      {
        workspace,
        user,
        project,
        completedBy,
        link,
      },
      {
        pretty: true,
      },
    );

    await resend.emails.send({
      from: "Team Zadaci <noreply@thegoodslab.tech>",
      to: [email],
      subject: `✅ Your project has been marked as completed!`,
      html,
    });
    console.log(`[email] sendProjectCompletionMail to ${email} succeeded`);
  } catch (error: any) {
    console.error(`[email] sendProjectCompletionMail to ${email} failed:`, error.message);
  }
}
