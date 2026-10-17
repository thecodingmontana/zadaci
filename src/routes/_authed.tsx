import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { NOINDEX } from "#/lib/seo";
import { getSession } from "#/lib/session";

// The browser reuses the session it checked for up to five minutes while you move around
// inside the app, so opening a task or switching tabs doesn't wait on a server round trip.
// Full page loads always check, and every API request verifies the session on the server.
const REUSE_MS = 5 * 60_000;
// an object, not a reassigned variable: the route component is code-split into another chunk
const last: {
	checked: {
		at: number;
		session: Awaited<ReturnType<typeof getSession>>;
	} | null;
} = { checked: null };

export const Route = createFileRoute("/_authed")({
	beforeLoad: async ({ location, cause }) => {
		const inBrowser = typeof window !== "undefined";
		const fresh =
			inBrowser &&
			cause === "stay" &&
			last.checked &&
			Date.now() - last.checked.at < REUSE_MS;
		const session =
			fresh && last.checked ? last.checked.session : await getSession();
		if (inBrowser && !fresh) last.checked = { at: Date.now(), session };
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
	component: AuthedLayout,
});

function AuthedLayout() {
	const { user } = Route.useRouteContext();
	// The server checked the session to render this page, so the first click inside the app
	// can reuse that check instead of waiting on another round trip.
	if (typeof window !== "undefined" && !last.checked)
		last.checked = { at: Date.now(), session: { user, secured: true } };
	return <Outlet />;
}
