import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "#/lib/auth";

// The same document at the issuer-suffixed address (RFC 8414: /.well-known/…/api/auth).
const metadata = oauthProviderAuthServerMetadata(auth);

export const Route = createFileRoute(
	"/.well-known/oauth-authorization-server/$",
)({
	server: { handlers: { GET: ({ request }) => metadata(request) } },
});
