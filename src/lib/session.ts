import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	getCookie,
	getRequestHeaders,
	setResponseHeaders,
} from "@tanstack/react-start/server";
import { auth } from "#/lib/auth";

// Only the user goes to the client; the session token must stay in the HttpOnly cookie.
export const getSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await auth.api.getSession({ headers: getRequestHeaders() });
		if (!session) return null;
		const { isAdmin } = await import("#/lib/ops.server");
		// shows the Admin page in the command menu; the page's data checks again on the server
		return { user: session.user, admin: isAdmin(session.user.email) };
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

/** Stops anyone ADMIN_EMAILS doesn't list with "not found" (the page guard alone protects
 * nothing: these functions are reachable directly). Admin answers are never cached. */
async function requireAdmin() {
	const session = await auth.api.getSession({ headers: getRequestHeaders() });
	const { isAdmin } = await import("#/lib/ops.server");
	if (!isAdmin(session?.user.email)) throw notFound();
	setResponseHeaders(new Headers({ "Cache-Control": "no-store" }));
}

export const getAdminDashboard = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireAdmin();
		const { adminDashboard } = await import("#/lib/admin-analytics.server");
		return adminDashboard();
	},
);

export const getAdminSystem = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireAdmin();
		const { adminSystem } = await import("#/lib/admin.server");
		return adminSystem();
	},
);

export const getAdminDirectory = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireAdmin();
		const { adminDirectory } = await import("#/lib/admin.server");
		return adminDirectory();
	},
);
