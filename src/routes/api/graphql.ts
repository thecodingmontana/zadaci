import { createFileRoute } from "@tanstack/react-router";
import { yoga } from "#/graphql/yoga.server";
import { drainEmails } from "#/lib/email.server";

export const Route = createFileRoute("/api/graphql")({
	server: {
		handlers: {
			GET: ({ request }) => yoga.fetch(request),
			// notification emails queued during the request go out before it answers
			POST: async ({ request }) => {
				const response = await yoga.fetch(request);
				await drainEmails();
				return response;
			},
		},
	},
});
