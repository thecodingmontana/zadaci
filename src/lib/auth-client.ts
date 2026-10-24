import { passkeyClient } from "@better-auth/passkey/client";
import { magicLinkClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	plugins: [twoFactorClient(), passkeyClient(), magicLinkClient()],
});
