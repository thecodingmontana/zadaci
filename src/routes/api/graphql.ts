import { createFileRoute } from "@tanstack/react-router";
import { yoga } from "#/graphql/yoga.server";
import { withEmails } from "#/lib/email.server";

// A plain Request for Yoga: the Node server's own request object is built lazily, and Yoga 6's body
// size limit reads it after locking the body, which fails ("body object should not be disturbed").
// It isn't a real Request either, so copy its parts (GraphQL bodies are small; Vercel caps them).
const plain = async (request: Request) =>
	new Request(request.url, {
		method: request.method,
		headers: request.headers,
		signal: request.signal,
		body:
			request.method === "GET" || request.method === "HEAD"
				? undefined
				: await request.arrayBuffer(),
	});

export const Route = createFileRoute("/api/graphql")({
	server: {
		handlers: {
			GET: async ({ request }) => yoga.fetch(await plain(request)),
			// notification emails queued during the request go out before it answers
			POST: ({ request }) =>
				withEmails(async () => yoga.fetch(await plain(request))),
		},
	},
});
