// Absolute URLs for canonical, Open Graph and the sitemap; set VITE_SITE_URL for a custom domain.
export const SITE_URL = (
	import.meta.env.VITE_SITE_URL ?? "https://zadaci.vercel.app"
).replace(/\/$/, "");

export const SITE_DESCRIPTION =
	"Zadaci is a collaborative task management platform for modern teams. Organize projects, manage tasks and stay in sync.";

// App and auth pages are private: keep them out of search results.
export const NOINDEX = { name: "robots", content: "noindex, nofollow" };
