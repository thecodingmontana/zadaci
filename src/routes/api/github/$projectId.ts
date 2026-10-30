import { createFileRoute } from "@tanstack/react-router";
import { githubWebhook } from "#/lib/github.server";

// GitHub calls this for a linked repo's pull requests (signed with the project's secret).
export const Route = createFileRoute("/api/github/$projectId")({
	server: {
		handlers: {
			POST: ({ request, params }) => githubWebhook(params.projectId, request),
		},
	},
});
