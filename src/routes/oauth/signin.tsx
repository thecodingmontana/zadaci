import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSession } from "#/lib/session";

// An AI agent asked to connect and you aren't signed in (or must choose to): sign in the usual way
// (Google, email link, passkey, two-step all keep `redirect`), then carry on to the approval.
export const Route = createFileRoute("/oauth/signin")({
	beforeLoad: async ({ location }) => {
		const authorize = `/api/auth/oauth2/authorize${location.searchStr}`;
		if (await getSession())
			throw redirect({ href: authorize, reloadDocument: true });
		throw redirect({ to: "/auth/signin", search: { redirect: authorize } });
	},
});
