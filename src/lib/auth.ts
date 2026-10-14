import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";
import { generateRandomString } from "better-auth/crypto";
import { twoFactor } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { generateNanoId } from "#/db/utils";
import { requireEnv } from "#/lib/env";

const TWO_FACTOR_COOKIE_MAX_AGE = 600;

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
		// Two-step verification is mandatory: never let a user remove their last second step.
		before: createAuthMiddleware(async (ctx) => {
			if (ctx.path !== "/two-factor/disable" && ctx.path !== "/passkey/delete-passkey") return;
			const session = await getSessionFromCtx(ctx);
			if (!session) return; // the endpoint itself rejects unauthenticated calls
			const passkeys = await db
				.select({ id: tables.passkey.id })
				.from(tables.passkey)
				.where(eq(tables.passkey.userId, session.user.id));
			const remaining =
				ctx.path === "/two-factor/disable"
					? passkeys.length
					: passkeys.length - 1 + (session.user.twoFactorEnabled ? 1 : 0);
			if (remaining < 1) {
				throw new APIError("BAD_REQUEST", {
					message: "Add another way to verify before removing this one.",
				});
			}
		}),
		// better-auth only challenges 2FA after credential sign-in; mirror its hook for the Google callback.
		after: createAuthMiddleware(async (ctx) => {
			if (!ctx.path.startsWith("/callback/")) return;
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
		twoFactor({
			issuer: "Zadaci",
			allowPasswordless: true, // Google-only accounts have no password
			twoFactorCookieMaxAge: TWO_FACTOR_COOKIE_MAX_AGE,
		}),
		passkey({ rpName: "Zadaci" }),
		tanstackStartCookies(), // must stay last
	],
});
