import { createFileRoute } from "@tanstack/react-router";
import { BUILD } from "#/lib/build";

// Which build the server runs: open tabs compare it with their own to offer a reload after a
// deploy (components/shell/app-status). Nothing private, never cached.
export const Route = createFileRoute("/api/version")({
	server: {
		handlers: {
			GET: () =>
				Response.json(
					{ build: BUILD },
					{ headers: { "Cache-Control": "no-store" } },
				),
		},
	},
});
