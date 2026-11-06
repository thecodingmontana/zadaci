import { createHash, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { runDaily } from "#/lib/daily.server";
import { syncAllLinkedProjects } from "#/lib/github-sync.server";
import { recordError, recordJobRun } from "#/lib/ops.server";

// Called every hour by .github/workflows/daily-notifications.yml with the CRON_SECRET: reminders,
// digests, and a GitHub repair pass for linked projects.
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
				try {
					const result = {
						...(await runDaily()),
						github: await syncAllLinkedProjects(),
					};
					await recordJobRun("hourly", true, result);
					return Response.json(result);
				} catch (error) {
					// the admin page shows the failed run and why
					const message = (error as Error).message;
					await recordError("cron", `hourly job failed: ${message}`);
					await recordJobRun("hourly", false, { error: message }).catch(
						() => {},
					);
					return new Response("The hourly job failed", { status: 500 });
				}
			},
		},
	},
});
