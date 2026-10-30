import { createFileRoute } from "@tanstack/react-router";
import { githubCallback } from "#/lib/github-connect.server";

// "Connect with GitHub" (see github-connect.server.ts).
export const Route = createFileRoute("/api/github/callback")({
	server: {
		handlers: {
			GET: ({ request }) => githubCallback(request),
		},
	},
});
