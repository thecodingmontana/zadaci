import assert from "node:assert/strict";
import { createPublicKey, verify } from "node:crypto";
import { after, test } from "node:test";
import { AUTH_ISSUER, auth } from "#/lib/auth";
import { cleanup, makeUser } from "./helpers";

after(cleanup);

const call = (path: string, cookie?: string) =>
	auth.handler(
		new Request(`${AUTH_ISSUER}/api/auth${path}`, {
			headers: cookie ? { cookie } : {},
		}),
	);

test("a signed-in person gets a short-lived token Supabase Realtime can verify, with no personal details", async () => {
	const amina = await makeUser("amina");
	const { token } = (await (await call("/token", amina.cookie)).json()) as { token: string };
	const [head, body, sig] = token.split(".");
	const header = JSON.parse(Buffer.from(head, "base64url").toString());
	const claims = JSON.parse(Buffer.from(body, "base64url").toString());

	// signed with a published RS256 key (Supabase reads /jwks and needs kid)
	const { keys } = (await (await call("/jwks")).json()) as { keys: { kid: string }[] };
	const key = keys.find((k) => k.kid === header.kid);
	assert.equal(header.alg, "RS256");
	assert.ok(key, "the token's key is published");
	assert.ok(
		verify("RSA-SHA256", Buffer.from(`${head}.${body}`), createPublicKey({ key, format: "jwk" } as never), Buffer.from(sig, "base64url")),
		"signature checks out",
	);

	assert.equal(claims.sub, amina.id);
	assert.equal(claims.role, "authenticated");
	assert.equal(claims.iss, AUTH_ISSUER);
	assert.equal(claims.aud, "authenticated");
	assert.ok(claims.exp - claims.iat <= 600, "lives 10 minutes at most");
	assert.equal(claims.email, undefined, "no email inside");

	assert.equal((await call("/token")).status, 401, "signed out: no token");
});
