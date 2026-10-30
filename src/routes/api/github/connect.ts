import { createFileRoute } from "@tanstack/react-router";
import { githubConnect } from "#/lib/github-connect.server";

// "Connect with GitHub" (see github-connect.server.ts).
export const Route = createFileRoute("/api/github/connect")({
	server: {
		handlers: {
			GET: ({ request }) => githubConnect(request),
		},
	},
});
