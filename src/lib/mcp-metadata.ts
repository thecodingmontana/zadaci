import { MCP_RESOURCE, MCP_SCOPES } from "#/lib/auth";

/** RFC 9728: /api/mcp is protected by Zadaci's own sign-in (the OAuth issuer is the site itself). */
export const protectedResource = () =>
	Response.json(
		{
			resource: MCP_RESOURCE,
			authorization_servers: [new URL(MCP_RESOURCE).origin],
			scopes_supported: MCP_SCOPES,
			bearer_methods_supported: ["header"],
			resource_name: "Zadaci",
		},
		{
			headers: {
				"cache-control": "public, max-age=300",
				"access-control-allow-origin": "*",
			},
		},
	);
