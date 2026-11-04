import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "#/lib/auth";

// Only the user goes to the client; the session token must stay in the HttpOnly cookie.
export const getSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await auth.api.getSession({ headers: getRequestHeaders() });
		return session ? { user: session.user } : null;
	},
);

// Read during SSR so a collapsed sidebar doesn't flash open on reload.
export const getSidebarOpen = createServerFn({ method: "GET" }).handler(
	() => getCookie("sidebar_state") !== "false",
);

/**
 * Which email a sign-in link signs into, for the confirm page (null when it's used up or expired).
 * Links are stored as `magic-link:` + base64url(sha256(token)), so the token itself is never kept.
 */
export const getSignInLinkEmail = createServerFn({ method: "GET" })
	.validator((token: unknown) =>
		typeof token === "string" ? token.slice(0, 200) : "",
	)
	.handler(async ({ data: token }) => {
		if (!token) return null;
		const { createHash } = await import("node:crypto");
		const { and, eq, gt } = await import("drizzle-orm");
		const { db, tables } = await import("#/db");
		const hashed = createHash("sha256").update(token).digest("base64url");
		const [row] = await db
			.select({ value: tables.verification.value })
			.from(tables.verification)
			.where(
				and(
					eq(tables.verification.identifier, `magic-link:${hashed}`),
					gt(tables.verification.expiresAt, new Date()),
				),
			);
		try {
			return (JSON.parse(row?.value ?? "") as { email?: string }).email ?? null;
		} catch {
			return null;
		}
	});
