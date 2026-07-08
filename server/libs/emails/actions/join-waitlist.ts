import { render } from "@vue-email/render";
import { resend } from "~~/server/libs/resend";
import Waitlist from "../templates/waitlist.vue";

interface Props {
  email: string;
}

export async function sendWaitlistMail({ email }: Props) {
  try {
    const html = await render(
      Waitlist,
      {},
      {
        pretty: true,
      },
    );

    await resend.emails.send({
      from: "Team Zadaci <onboarding@resend.dev>",
      to: [email],
      subject: `You're on the waitlist!`,
      html,
    });
  } catch (error: any) {
    throw new Error(error.message);
  }
}
