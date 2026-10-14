import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "#/lib/auth";

// Only the user goes to the client; the session token must stay in the HttpOnly cookie.
export const getSession = createServerFn({ method: "GET" }).handler(async () => {
	const session = await auth.api.getSession({ headers: getRequestHeaders() });
	return session ? { user: session.user } : null;
});
