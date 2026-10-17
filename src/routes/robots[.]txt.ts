import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "#/lib/seo";

// Sign-in pages stay crawlable so search engines can read their noindex and drop them.
const ROBOTS = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /w/
Disallow: /workspace
Disallow: /onboarding
Disallow: /join/

Sitemap: ${SITE_URL}/sitemap.xml
`;

export const Route = createFileRoute("/robots.txt")({
	server: {
		handlers: {
			GET: () =>
				new Response(ROBOTS, {
					headers: { "content-type": "text/plain; charset=utf-8" },
				}),
		},
	},
});
