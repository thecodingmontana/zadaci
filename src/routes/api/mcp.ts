import { createFileRoute } from "@tanstack/react-router";
import { mcpResponse } from "#/lib/mcp.server";

// Zadaci for AI agents (MCP, Streamable HTTP, stateless). Sign-in: /.well-known/oauth-protected-resource.
export const Route = createFileRoute("/api/mcp")({
	server: {
		handlers: {
			POST: ({ request }) => mcpResponse(request),
			// no server-sent stream or sessions to resume: stateless
			GET: () =>
				new Response(null, { status: 405, headers: { allow: "POST" } }),
		},
	},
});
