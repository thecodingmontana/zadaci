import { createFileRoute } from "@tanstack/react-router";
import { modelStatus } from "#/lib/ai/rotation.server";
import { authorized } from "../cron/daily";

// Internal: the assistant's model ranking, failures and cooldowns. Needs the CRON_SECRET.
export const Route = createFileRoute("/api/ai/models")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				if (!authorized(request.headers.get("authorization")))
					return new Response("Unauthorized", { status: 401 });
				return Response.json(await modelStatus());
			},
		},
	},
});
