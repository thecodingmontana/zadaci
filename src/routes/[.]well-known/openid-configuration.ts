import { createFileRoute } from "@tanstack/react-router";
import { AUTH_ISSUER } from "#/lib/auth";

// Lets Supabase trust Zadaci's sign-in for Realtime's private channels: it reads the public
// signing keys from jwks_uri and checks each token's issuer against `issuer`.
export const Route = createFileRoute("/.well-known/openid-configuration")({
	server: {
		handlers: {
			GET: () =>
				Response.json(
					{
						issuer: AUTH_ISSUER,
						jwks_uri: `${AUTH_ISSUER}/api/auth/jwks`,
						id_token_signing_alg_values_supported: ["RS256"],
						subject_types_supported: ["public"],
						response_types_supported: ["id_token"],
					},
					{ headers: { "cache-control": "public, max-age=300" } },
				),
		},
	},
});
