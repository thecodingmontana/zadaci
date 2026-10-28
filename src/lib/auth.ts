import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";
import { generateRandomString } from "better-auth/crypto";
import { jwt, magicLink, twoFactor } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { eq } from "drizzle-orm";
import { createElement } from "react";
import { db, tables } from "#/db";
import { generateNanoId } from "#/db/utils";
import MagicLinkEmail from "#/emails/magic-link";
import { isDicebearUrl } from "#/lib/dicebear";
import { sendEmail } from "#/lib/email.server";
import { requireEnv } from "#/lib/env";
import { SITE_URL } from "#/lib/seo";

const TWO_FACTOR_COOKIE_MAX_AGE = 600;

/** Picture addresses we serve or trust: our Cloudinary, generated avatars, Unsplash, Google's photos. */
export function isAllowedPicture(value: string) {
	if (isDicebearUrl(value)) return true;
	try {
		const url = new URL(value);
		if (url.protocol !== "https:") return false;
		return (
			(url.hostname === "res.cloudinary.com" &&
				url.pathname.startsWith(
					`/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`,
				)) ||
			url.hostname === "images.unsplash.com" ||
			url.hostname.endsWith(".googleusercontent.com")
		);
	} catch {
		return false;
	}
}
const MAGIC_LINK_MINUTES = 10;

/** Second-step methods a user has set up: an authenticator app (TOTP) and/or passkeys. */
export async function secondFactors(user: {
	id: string;
	twoFactorEnabled?: boolean | null;
}) {
	const [key] = await db
		.select({ id: tables.passkey.id })
		.from(tables.passkey)
		.where(eq(tables.passkey.userId, user.id))
		.limit(1);
	return [
		...(user.twoFactorEnabled ? ["totp"] : []),
		...(key ? ["passkey"] : []),
	];
}

/** Who signs the tokens Supabase Realtime trusts (its discovery document is at /.well-known). */
export const AUTH_ISSUER = (process.env.BETTER_AUTH_URL ?? SITE_URL).replace(
	/\/$/,
	"",
);

export const auth = betterAuth({
	appName: "Zadaci",
	secret: requireEnv("BETTER_AUTH_SECRET"),
	database: drizzleAdapter(db, { provider: "pg", schema: tables }),
	advanced: { database: { generateId: () => generateNanoId() } },
	// counted in Postgres, not each server's memory, so limits hold across Vercel instances
	rateLimit: { enabled: true, storage: "database" },
	user: {
		additionalFields: {
			whatsNewLastSeenVersion: {
				type: "string",
				required: false,
				input: false,
			},
		},
	},
	databaseHooks: {
		user: {
			update: {
				// a picture can only come from places we trust, so a member can't point their avatar at
				// a server that logs every teammate who sees it
				before: async (user) => {
					const image = (user as { image?: string | null }).image;
					if (image && !isAllowedPicture(image))
						throw new APIError("BAD_REQUEST", {
							message:
								"Choose a picture you uploaded, an avatar or an Unsplash photo",
						});
					return { data: user };
				},
			},
			create: {
				// email-link sign-ups come without a name: start from the email ("amina.k@…" → "Amina K")
				before: async (user) => ({
					data: {
						...user,
						name:
							user.name?.trim() ||
							user.email
								.split("@")[0]
								.split(/[._+-]+/)
								.filter(Boolean)
								.map((w) => w[0].toUpperCase() + w.slice(1))
								.join(" ") ||
							"New member",
					},
				}),
			},
		},
	},
	socialProviders: {
		google: {
			clientId: requireEnv("GOOGLE_CLIENT_ID"),
			clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
			// ID-token sign-in creates a session without the /callback hook below, which would skip 2FA.
			disableIdTokenSignIn: true,
		},
	},
	hooks: {
		// better-auth only challenges 2FA after credential sign-in; mirror its hook for the Google
		// callback and for signing in from an emailed link, so neither skips the second step.
		after: createAuthMiddleware(async (ctx) => {
			if (
				!ctx.path.startsWith("/callback/") &&
				ctx.path !== "/magic-link/verify"
			)
				return;
			const data = ctx.context.newSession;
			if (!data) return;
			const methods = await secondFactors(data.user);
			if (!methods.length) return;

			deleteSessionCookie(ctx, true);
			await ctx.context.internalAdapter.deleteSession(data.session.token);
			ctx.context.setNewSession(null);

			const twoFactorCookie = ctx.context.createAuthCookie("two_factor", {
				maxAge: TWO_FACTOR_COOKIE_MAX_AGE,
			});
			const identifier = `2fa-${generateRandomString(20)}`;
			const expiresAt = new Date(Date.now() + TWO_FACTOR_COOKIE_MAX_AGE * 1000);
			await ctx.context.internalAdapter.createVerificationValue({
				value: data.user.id,
				identifier,
				expiresAt,
			});
			// verify-totp counts failed attempts against this record
			await ctx.context.internalAdapter.createVerificationValue({
				value: "0",
				identifier: `2fa-attempts-${identifier}`,
				expiresAt,
			});
			await ctx.setSignedCookie(
				twoFactorCookie.name,
				identifier,
				ctx.context.secret,
				twoFactorCookie.attributes,
			);
			throw ctx.redirect(`/auth/two-factor?methods=${methods.join(",")}`);
		}),
	},
	plugins: [
		// short-lived tokens for Supabase Realtime's private channels: only who you are and the
		// role Supabase needs, signed with a key pair (Supabase reads the public half at /jwks)
		jwt({
			jwks: { keyPairConfig: { alg: "RS256", modulusLength: 2048 } },
			jwt: {
				issuer: AUTH_ISSUER,
				audience: "authenticated",
				expirationTime: "10m",
				definePayload: () => ({ role: "authenticated" }),
			},
			disableSettingJwtHeader: true,
		}),
		twoFactor({
			issuer: "Zadaci",
			allowPasswordless: true, // Google-only accounts have no password
			twoFactorCookieMaxAge: TWO_FACTOR_COOKIE_MAX_AGE,
		}),
		passkey({ rpName: "Zadaci" }),
		// "Email me a sign-in link": a single-use link, stored hashed, valid for 10 minutes
		magicLink({
			expiresIn: MAGIC_LINK_MINUTES * 60,
			storeToken: "hashed",
			sendMagicLink: async ({ email, url }) => {
				const sent = await sendEmail(
					email,
					"Your Zadaci sign-in link",
					createElement(MagicLinkEmail, {
						link: url,
						baseUrl: SITE_URL,
						minutes: MAGIC_LINK_MINUTES,
					}),
				);
				if (sent) return;
				// local development without Resend: the link goes to the terminal instead
				if (
					!process.env.RESEND_API_KEY &&
					process.env.NODE_ENV !== "production"
				)
					return console.info(`[auth] sign-in link for ${email}: ${url}`);
				throw new Error(
					"Couldn't send the sign-in email. Try again in a moment.",
				);
			},
		}),
		tanstackStartCookies(), // must stay last
	],
});
