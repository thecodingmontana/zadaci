import { createFileRoute } from "@tanstack/react-router";
import { protectedResource } from "#/lib/mcp-metadata";

// Tells an AI agent that /api/mcp needs a Zadaci sign-in, and where to get one.
export const Route = createFileRoute("/.well-known/oauth-protected-resource/$")(
	{
		server: { handlers: { GET: () => protectedResource() } },
	},
);
