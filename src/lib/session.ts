import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeaders } from "@tanstack/react-start/server";
import { auth, secondFactors } from "#/lib/auth";

// Only the user goes to the client; the session token must stay in the HttpOnly cookie.
export const getSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await auth.api.getSession({ headers: getRequestHeaders() });
		if (!session) return null;
		const secured = (await secondFactors(session.user)).length > 0;
		return { user: session.user, secured };
	},
);

// Read during SSR so a collapsed sidebar doesn't flash open on reload.
export const getSidebarOpen = createServerFn({ method: "GET" }).handler(
	() => getCookie("sidebar_state") !== "false",
);
