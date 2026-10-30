import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { after, test } from "node:test";
import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { auth, MCP_RESOURCE } from "#/lib/auth";
import { protectedResource } from "#/lib/mcp-metadata";
import { cleanup, makeUser } from "./helpers";

after(cleanup);

// An AI agent connecting the way MCP clients do: discover, register itself, send the person to
// approve, swap the code for a token for /api/mcp.
const BASE = "http://localhost:3000";
const call = (path: string, init: RequestInit & { cookie?: string } = {}) =>
	auth.handler(
		new Request(BASE + path, {
			...init,
			redirect: "manual",
			headers: { origin: BASE, ...(init.cookie ? { cookie: init.cookie } : {}), ...(init.headers as Record<string, string>) },
		}),
	);
const b64url = (b: Buffer) => b.toString("base64url");
const CALLBACK = "http://127.0.0.1:33418/callback";

// one registered agent for the whole file: registration is rate-limited per IP, like in production
let registered: Promise<{ client_id: string }> | undefined;
const register = () => (registered ??= registerOnce());
async function registerOnce() {
	const res = await call("/api/auth/oauth2/register", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			client_name: "Test Agent",
			redirect_uris: [CALLBACK],
			token_endpoint_auth_method: "none",
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
		}),
	});
	assert.ok(res.status < 300, await res.clone().text());
	return (await res.json()) as { client_id: string };
}

function authorizeUrl(clientId: string) {
	const verifier = b64url(randomBytes(32));
	const q = new URLSearchParams({
		response_type: "code",
		client_id: clientId,
		redirect_uri: CALLBACK,
		scope: "profile email offline_access",
		state: "xyz",
		code_challenge: b64url(createHash("sha256").update(verifier).digest()),
		code_challenge_method: "S256",
		resource: MCP_RESOURCE,
	});
	return { url: `/api/auth/oauth2/authorize?${q}`, verifier };
}

const exchange = (code: string, clientId: string, verifier: string) =>
	call("/api/auth/oauth2/token", {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: CALLBACK,
			client_id: clientId,
			code_verifier: verifier,
			resource: MCP_RESOURCE,
		}),
	});

test("an AI agent discovers Zadaci's sign-in for /api/mcp", async () => {
	const pr = (await protectedResource().json()) as { resource: string; authorization_servers: string[] };
	assert.equal(pr.resource, MCP_RESOURCE);
	const meta = (await (await oauthProviderAuthServerMetadata(auth)(new Request(`${BASE}/.well-known/oauth-authorization-server`))).json()) as Record<string, unknown>;
	assert.equal(meta.issuer, pr.authorization_servers[0], "the resource points at this issuer");
	assert.ok(String(meta.registration_endpoint).endsWith("/oauth2/register"), "agents can register themselves");
	assert.ok((meta.code_challenge_methods_supported as string[]).includes("S256"));
});

test("an agent signs in as the person after they approve, and gets a token for /api/mcp", async () => {
	const me = await makeUser("agent-owner", false);
	const { client_id } = await register();
	const { url, verifier } = authorizeUrl(client_id);

	// signed out: off to sign in first
	const out = await call(url);
	assert.match(out.headers.get("location") ?? "", /\/oauth\/signin\?/);

	// signed in: off to approve
	const asked = await call(url, { cookie: me.cookie });
	const consent = asked.headers.get("location") ?? "";
	assert.match(consent, /\/oauth\/consent\?/);

	const approved = await call("/api/auth/oauth2/consent", {
		method: "POST",
		cookie: me.cookie,
		headers: { "content-type": "application/json", accept: "application/json" },
		body: JSON.stringify({ accept: true, oauth_query: consent.split("?")[1] ?? "" }),
	});
	const back = new URL(((await approved.json()) as { url: string }).url);
	assert.equal(back.searchParams.get("state"), "xyz");
	const code = back.searchParams.get("code") ?? "";
	assert.ok(code, "an authorization code came back");

	const tokens = (await (await exchange(code, client_id, verifier)).json()) as {
		access_token?: string;
		refresh_token?: string;
		expires_in?: number;
	};
	assert.ok(tokens.access_token, JSON.stringify(tokens));
	assert.ok(tokens.refresh_token, "it stays connected (offline_access)");
	assert.ok((tokens.expires_in ?? 0) <= 600, "short-lived");
	const claims = JSON.parse(Buffer.from(tokens.access_token?.split(".")[1] ?? "", "base64url").toString());
	assert.equal(claims.sub, me.id, "it acts as the person");
	assert.ok([claims.aud].flat().includes(MCP_RESOURCE), "only for /api/mcp");
	// a code works once: replaying it (or a stolen copy) gets nothing
	assert.ok((await exchange(code, client_id, verifier)).status >= 400);
});

test("denying sends the agent away empty-handed", async () => {
	const me = await makeUser("agent-denier", false);
	const { client_id } = await register();
	const consent = (await call(authorizeUrl(client_id).url, { cookie: me.cookie })).headers.get("location") ?? "";
	const denied = await call("/api/auth/oauth2/consent", {
		method: "POST",
		cookie: me.cookie,
		headers: { "content-type": "application/json", accept: "application/json" },
		body: JSON.stringify({ accept: false, oauth_query: consent.split("?")[1] ?? "" }),
	});
	const back = new URL(((await denied.json()) as { url: string }).url);
	assert.equal(back.searchParams.get("error"), "access_denied");
	assert.equal(back.searchParams.get("code"), null);
});
