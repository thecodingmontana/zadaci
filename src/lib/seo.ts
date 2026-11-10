// Absolute URLs for canonical, Open Graph, the sitemap and emails; set VITE_SITE_URL for a custom domain.
// `env?.` because tests and the email preview run outside Vite.
export const SITE_URL = (
	import.meta.env?.VITE_SITE_URL ?? "https://zadaci.vercel.app"
).replace(/\/$/, "");

export const SITE_DESCRIPTION =
	"Plan projects on boards and timelines, write notes, chat with your team and let AI agents help, all in one free workspace that syncs with GitHub.";

/** A public page's own title, description and canonical, for search results and link previews. */
export function pageHead(title: string, description: string, path: string) {
	const url = `${SITE_URL}${path}`;
	return {
		meta: [
			{ title },
			{ name: "description", content: description },
			{ property: "og:title", content: title },
			{ property: "og:description", content: description },
			{ property: "og:url", content: url },
			{ name: "twitter:title", content: title },
			{ name: "twitter:description", content: description },
			{ name: "twitter:url", content: url },
		],
		links: [{ rel: "canonical", href: url }],
	};
}

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

/** Where people reach a person: support links and the reply-to on every email. */
export const SUPPORT_EMAIL = "thecodingmontana@gmail.com";
