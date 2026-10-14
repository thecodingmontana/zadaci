import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, twoFactor } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Resend } from "resend";
import { db, tables } from "#/db";
import { generateNanoId } from "#/db/utils";

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail(to: string, subject: string, text: string) {
	const { error } = await resend.emails.send({
		from: process.env.EMAIL_FROM!,
		to,
		subject,
		text,
	});
	if (error) throw new Error(`Email to ${to} failed: ${error.message}`);
}

export const auth = betterAuth({
	appName: "Zadaci",
	database: drizzleAdapter(db, { provider: "pg", schema: tables }),
	advanced: { database: { generateId: () => generateNanoId() } },
	user: {
		additionalFields: {
			whatsNewLastSeenVersion: {
				type: "string",
				required: false,
				input: false,
			},
		},
	},
	emailAndPassword: {
		enabled: true,
		sendResetPassword: ({ user, url }) =>
			sendEmail(
				user.email,
				"Reset your Zadaci password",
				`Reset your password: ${url}`,
			),
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		},
	},
	plugins: [
		emailOTP({
			sendVerificationOTP: ({ email, otp }) =>
				sendEmail(
					email,
					"Your Zadaci code",
					`Your verification code is ${otp}. It expires in 5 minutes.`,
				),
		}),
		twoFactor(),
		passkey({ rpName: "Zadaci" }),
		tanstackStartCookies(), // must stay last
	],
});
