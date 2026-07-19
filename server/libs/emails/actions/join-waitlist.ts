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
      from: "Team Zadaci <noreply@thegoodslab.tech>",
      to: [email],
      subject: `You're on the waitlist!`,
      html,
    });
    console.log(`[email] sendWaitlistMail to ${email} succeeded`);
  } catch (error: any) {
    console.error(`[email] sendWaitlistMail to ${email} failed:`, error.message);
  }
}
