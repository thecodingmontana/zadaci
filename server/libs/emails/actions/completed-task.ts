import { render } from "@vue-email/render";
import { resend } from "~~/server/libs/resend";
import CompletedTaskMail from "../templates/completed-task-mail.vue";

interface TaskCompletionMailProps {
  email: string;
  user: string;
  task: string;
  project: string;
  workspace: string;
  completedBy: string;
  link: string;
}

export async function sendTaskCompletionMail({
  email,
  workspace,
  user,
  task,
  project,
  completedBy,
  link,
}: TaskCompletionMailProps) {
  try {
    const html = await render(
      CompletedTaskMail,
      {
        workspace,
        user,
        task,
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
      subject: `✅ Your task has been marked as completed!`,
      html,
    });
    console.log(`[email] sendTaskCompletionMail to ${email} succeeded`);
  } catch (error: any) {
    console.error(`[email] sendTaskCompletionMail to ${email} failed:`, error.message);
  }
}
