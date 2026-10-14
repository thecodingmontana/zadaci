import { createFileRoute } from "@tanstack/react-router";
import { yoga } from "#/graphql/yoga.server";

export const Route = createFileRoute("/api/graphql")({
	server: {
		handlers: {
			GET: ({ request }) => yoga.fetch(request),
			POST: ({ request }) => yoga.fetch(request),
		},
	},
});
