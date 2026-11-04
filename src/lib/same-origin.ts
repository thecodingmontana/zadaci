/**
 * A browser request sent by another site (CSRF): the session cookie would ride along, so routes
 * that change things refuse it. Same-origin requests, typed-in navigations and non-browser callers
 * (no Origin, no Sec-Fetch-Site, like tests and webhooks) pass.
 */
export function crossSite(request: Request) {
	const site = request.headers.get("sec-fetch-site");
	if (site && site !== "same-origin" && site !== "none") return true;
	const origin = request.headers.get("origin");
	return !!origin && origin !== new URL(request.url).origin;
}

export const forbidden = () =>
	new Response("Cross-site requests aren't allowed", { status: 403 });
