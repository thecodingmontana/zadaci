import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSession } from "#/lib/session";

export const Route = createFileRoute("/_authed")({
	beforeLoad: async ({ location }) => {
		const session = await getSession();
		if (!session)
			throw redirect({
				to: "/auth/signin",
				search: { redirect: location.href },
			});
		// two-step verification is mandatory before entering the app
		if (!session.secured) throw redirect({ to: "/auth/two-factor/setup" });
		return { user: session.user };
	},
	component: Outlet,
});
