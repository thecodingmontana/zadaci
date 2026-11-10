import { createFileRoute } from "@tanstack/react-router";
import { REPO_URL } from "#/components/shell/credits";
import { fetchRepoStats } from "#/lib/github-repo";

// The repo's stars and forks for the landing page's "Star on GitHub" buttons, and nothing else.
// Cached at the edge for an hour; a failed lookup only for a minute.
export const Route = createFileRoute("/api/github-repo")({
	server: {
		handlers: {
			GET: async () => {
				const stats = await fetchRepoStats(REPO_URL);
				return Response.json(stats, {
					headers: {
						"Cache-Control":
							stats.stars === null
								? "public, s-maxage=60"
								: "public, s-maxage=3600, stale-while-revalidate=86400",
					},
				});
			},
		},
	},
});
