import { createFileRoute } from "@tanstack/react-router";
import { exportAccount } from "#/lib/account.server";
import { auth } from "#/lib/auth";

// Download your data: everything that's yours, as one JSON file.
export const Route = createFileRoute("/api/account/export")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const session = await auth.api.getSession({ headers: request.headers });
				if (!session) return new Response("Sign in first", { status: 401 });
				const data = await exportAccount(session.user.id);
				const day = new Date().toISOString().slice(0, 10);
				return new Response(JSON.stringify(data, null, 2), {
					headers: {
						"content-type": "application/json; charset=utf-8",
						"content-disposition": `attachment; filename="zadaci-my-data-${day}.json"`,
						"cache-control": "no-store",
					},
				});
			},
		},
	},
});
