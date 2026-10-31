import { createFileRoute } from "@tanstack/react-router";
import { githubAppWebhook } from "#/lib/github.server";

// The Zadaci GitHub App's one webhook: pull requests from every repo it's installed on (signed
// with GITHUB_APP_WEBHOOK_SECRET), for the projects that linked them.
export const Route = createFileRoute("/api/github/app")({
	server: {
		handlers: {
			POST: ({ request }) => githubAppWebhook(request),
		},
	},
});
