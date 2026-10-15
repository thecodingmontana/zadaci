import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "#/lib/seo";

// The homepage is the only public page; everything else sits behind sign-in.
const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
</urlset>
`;

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: () =>
				new Response(SITEMAP, {
					headers: { "content-type": "application/xml; charset=utf-8" },
				}),
		},
	},
});
