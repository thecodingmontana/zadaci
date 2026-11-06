import { createFileRoute } from "@tanstack/react-router";
import { recordError } from "#/lib/ops.server";
import { takeAllowance } from "#/lib/rate-limit.server";

// Crashes reported by the browser's error page (lib/report-error), logged and kept for /admin.
// Only the message, a short stack and the path are kept: no note text, emails or user data.
const MAX = 4000;

export const Route = createFileRoute("/api/client-error")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				// anyone can call this: a cap per address keeps it from flooding the logs
				const ip =
					request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
					"unknown";
				// per address, and for everyone together: rotating addresses can't flood the error
				// log and push real errors off the admin page
				if (
					!(await takeAllowance(`client-error:${ip}`, 1, 30, 60_000)) ||
					!(await takeAllowance("client-error:all", 1, 300, 60_000))
				)
					return new Response(null, { status: 429 });
				const text = (await request.text()).slice(0, MAX);
				let report: { message?: unknown; stack?: unknown; path?: unknown };
				try {
					report = JSON.parse(text);
				} catch {
					return new Response(null, { status: 400 });
				}
				// one line per field, so a report can't fake other log lines
				const str = (v: unknown, n: number) =>
					typeof v === "string" ? v.slice(0, n).replace(/[\r\n]+/g, " ⏎ ") : "";
				// the stack goes to the logs only; the admin page keeps where and what
				console.error(`[client] stack: ${str(report.stack, 2000)}`);
				await recordError(
					"client",
					`${str(report.path, 200)}: ${str(report.message, 500)}`,
				);
				return new Response(null, { status: 204 });
			},
		},
	},
});
