import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";
import { generateRandomString } from "better-auth/crypto";
import { twoFactor } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db, tables } from "#/db";
import { generateNanoId } from "#/db/utils";
import { requireEnv } from "#/lib/env";

const TWO_FACTOR_COOKIE_MAX_AGE = 600;

export const auth = betterAuth({
	appName: "Zadaci",
	secret: requireEnv("BETTER_AUTH_SECRET"),
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
	socialProviders: {
		google: {
			clientId: requireEnv("GOOGLE_CLIENT_ID"),
			clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
		},
	},
	hooks: {
		// better-auth only challenges 2FA after credential sign-in; mirror its hook for the Google callback.
		after: createAuthMiddleware(async (ctx) => {
			if (!ctx.path.startsWith("/callback/")) return;
			const data = ctx.context.newSession;
			if (!data?.user.twoFactorEnabled) return;

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
			throw ctx.redirect("/auth/two-factor");
		}),
	},
	plugins: [
		twoFactor({
			issuer: "Zadaci",
			allowPasswordless: true, // Google-only accounts have no password
			twoFactorCookieMaxAge: TWO_FACTOR_COOKIE_MAX_AGE,
		}),
		passkey({ rpName: "Zadaci" }),
		tanstackStartCookies(), // must stay last
	],
});
