// Absolute URLs for canonical, Open Graph, the sitemap and emails; set VITE_SITE_URL for a custom domain.
// `env?.` because tests and the email preview run outside Vite.
export const SITE_URL = (
	import.meta.env?.VITE_SITE_URL ?? "https://zadaci.vercel.app"
).replace(/\/$/, "");

export const SITE_DESCRIPTION =
	"Zadaci is a collaborative task management platform for modern teams. Organize projects, manage tasks and stay in sync.";

// App and auth pages are private: keep them out of search results.
export const NOINDEX = { name: "robots", content: "noindex, nofollow" };

/** "Page - Workspace name" for tabs inside a workspace; the workspace layout loads the name. */
export function wsTitle(
	matches: { routeId: string; loaderData?: unknown }[],
	page: string,
) {
	const ws = matches.find((m) => m.routeId === "/_authed/w/$slug")
		?.loaderData as { workspaceName?: string } | undefined;
	return ws?.workspaceName ? `${page} - ${ws.workspaceName}` : page;
}
