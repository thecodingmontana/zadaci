import { render } from "@vue-email/render";
import { resend } from "~~/server/libs/resend";
import UniqueCodeRequest from "../templates/unique-code-request.vue";

interface Props {
  code: string;
  email: string;
}

export async function sendUniqueCodeRequest({ code, email }: Props) {
  try {
    const html = await render(
      UniqueCodeRequest,
      {
        code,
      },
      {
        pretty: true,
      },
    );

    await resend.emails.send({
      from: "Team Zadaci <noreply@thegoodslab.tech>",
      to: [email],
      subject: `Your unique Zadaci sign up code is ${code}`,
      html,
    });
    console.log(`[email] sendUniqueCodeRequest to ${email} succeeded`);
  } catch (error: any) {
    console.error(`[email] sendUniqueCodeRequest to ${email} failed:`, error.message);
  }
}
