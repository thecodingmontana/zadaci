import { createHash, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { runDaily } from "#/lib/daily.server";

// Called every hour by .github/workflows/daily-notifications.yml with the CRON_SECRET.
const digest = (value: string) => createHash("sha256").update(value).digest();

export function authorized(
	header: string | null,
	secret = process.env.CRON_SECRET,
) {
	if (!secret || !header) return false;
	return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

export const Route = createFileRoute("/api/cron/daily")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				if (!authorized(request.headers.get("authorization")))
					return new Response("Unauthorized", { status: 401 });
				return Response.json(await runDaily());
			},
		},
	},
});
