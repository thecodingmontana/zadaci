import { createFileRoute } from "@tanstack/react-router";
import { yoga } from "#/graphql/yoga.server";
import { withEmails } from "#/lib/email.server";

export const Route = createFileRoute("/api/graphql")({
	server: {
		handlers: {
			GET: ({ request }) => yoga.fetch(request),
			// notification emails queued during the request go out before it answers
			POST: ({ request }) => withEmails(async () => yoga.fetch(request)),
		},
	},
});
