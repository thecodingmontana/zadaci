import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "#/lib/auth";

// How AI agents (MCP clients) sign in as a person: where to register, authorize and get tokens.
const metadata = oauthProviderAuthServerMetadata(auth);

export const Route = createFileRoute("/.well-known/oauth-authorization-server")(
	{
		server: { handlers: { GET: ({ request }) => metadata(request) } },
	},
);
