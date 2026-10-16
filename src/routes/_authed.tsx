import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { NOINDEX } from "#/lib/seo";
import { getSession } from "#/lib/session";

// The browser reuses the session it checked for up to five minutes while you move around
// inside the app, so opening a task or switching tabs doesn't wait on a server round trip.
// Full page loads always check, and every API request verifies the session on the server.
const REUSE_MS = 5 * 60_000;
let checked: {
	at: number;
	session: Awaited<ReturnType<typeof getSession>>;
} | null = null;

export const Route = createFileRoute("/_authed")({
	beforeLoad: async ({ location, cause }) => {
		const inBrowser = typeof window !== "undefined";
		const fresh =
			inBrowser &&
			cause === "stay" &&
			checked &&
			Date.now() - checked.at < REUSE_MS;
		const session = fresh && checked ? checked.session : await getSession();
		if (inBrowser && !fresh) checked = { at: Date.now(), session };
		if (!session)
			throw redirect({
				to: "/auth/signin",
				search: { redirect: location.href },
			});
		// two-step verification is mandatory before entering the app
		if (!session.secured) throw redirect({ to: "/auth/two-factor/setup" });
		return { user: session.user };
	},
	head: () => ({ meta: [NOINDEX] }),
	component: Outlet,
});
