import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSession } from "#/lib/session";

export const Route = createFileRoute("/_authed")({
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) throw redirect({ to: "/auth/signin" });
		// two-step verification is mandatory before entering the app
		if (!session.user.twoFactorEnabled)
			throw redirect({ to: "/auth/two-factor/setup" });
		return { user: session.user };
	},
	component: Outlet,
});
