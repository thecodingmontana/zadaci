import { createFileRoute } from "@tanstack/react-router";

// Crashes reported by the browser's error page (lib/report-error), written to the server logs.
// Only the message, a short stack and the path are kept: no note text, emails or user data.
const MAX = 4000;

export const Route = createFileRoute("/api/client-error")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const text = (await request.text()).slice(0, MAX);
				let report: { message?: unknown; stack?: unknown; path?: unknown };
				try {
					report = JSON.parse(text);
				} catch {
					return new Response(null, { status: 400 });
				}
				const str = (v: unknown, n: number) =>
					typeof v === "string" ? v.slice(0, n) : "";
				console.error(
					`[client] ${str(report.path, 200)}: ${str(report.message, 500)}\n${str(report.stack, 2000)}`,
				);
				return new Response(null, { status: 204 });
			},
		},
	},
});
