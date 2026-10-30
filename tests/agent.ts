import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { auth, MCP_RESOURCE } from "#/lib/auth";

// An AI agent connecting the way MCP clients do: discover, register itself, send the person to
// approve, swap the code for a token for /api/mcp.
export const BASE = "http://localhost:3000";
export const call = (path: string, init: RequestInit & { cookie?: string } = {}) =>
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
export const register = () => (registered ??= registerOnce());
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

export function authorizeUrl(clientId: string) {
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

export const exchange = (code: string, clientId: string, verifier: string) =>
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

/** The whole connect flow for a signed-in person (their session cookie): a live access token for /api/mcp. */
export async function connectAgent(cookie: string) {
	const { client_id } = await register();
	const { url, verifier } = authorizeUrl(client_id);
	const consent = (await call(url, { cookie })).headers.get("location") ?? "";
	const approved = await call("/api/auth/oauth2/consent", {
		method: "POST",
		cookie,
		headers: { "content-type": "application/json", accept: "application/json" },
		body: JSON.stringify({ accept: true, oauth_query: consent.split("?")[1] ?? "" }),
	});
	const code = new URL(((await approved.json()) as { url: string }).url).searchParams.get("code") ?? "";
	const tokens = (await (await exchange(code, client_id, verifier)).json()) as { access_token?: string };
	assert.ok(tokens.access_token, JSON.stringify(tokens));
	return { token: tokens.access_token, clientId: client_id };
}
