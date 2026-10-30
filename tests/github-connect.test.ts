import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { githubCallback, githubConnect } from "#/lib/github-connect.server";
import { cleanup, gql, join, makeUser, makeWorkspace, type TestUser } from "./helpers";

after(cleanup);

// "Connect GitHub": connect your account once, then pick a repo in a project and we add its
// webhook. GitHub itself is faked here: no request leaves the machine.
process.env.GITHUB_CLIENT_ID = "test-client";
process.env.GITHUB_CLIENT_SECRET = "test-secret";

type Call = { url: string; method: string; body?: Record<string, unknown> };
const calls: Call[] = [];
let hooks: { id: number; config: { url: string } }[] = [];
let admin = true;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
	const url = String(input);
	if (!url.startsWith("https://github.com/") && !url.startsWith("https://api.github.com/")) return realFetch(input, init);
	const method = init?.method ?? "GET";
	const body = init?.body ? JSON.parse(String(init.body)) : undefined;
	calls.push({ url, method, body });
	if (url.includes("/login/oauth/access_token"))
		return Response.json(body.code === "good" ? { access_token: "gho_secret_token" } : { error: "bad_verification_code" });
	if (url.endsWith("/user")) return Response.json({ login: "octo" });
	if (url.includes("/user/repos"))
		return Response.json([
			{ full_name: "octo/mine", permissions: { admin: true } },
			{ full_name: "other/theirs", permissions: { admin: false } },
		]);
	if (url.includes("/applications/")) return new Response(null, { status: 204 });
	if (!admin) return new Response("Not Found", { status: 404 });
	if (method === "GET") return Response.json(hooks);
	if (method === "POST") {
		hooks = [{ id: 1, config: { url: body.config.url } }];
		return Response.json(hooks[0], { status: 201 });
	}
	if (method === "DELETE") {
		hooks = [];
		return new Response(null, { status: 204 });
	}
	return Response.json(hooks[0]);
}) as typeof fetch;
after(() => {
	globalThis.fetch = realFetch;
});

const get = (fn: (r: Request) => Promise<Response>, user: TestUser | null, path: string) =>
	fn(new Request(`http://localhost:3000${path}`, { headers: user ? { cookie: user.cookie } : {} }));
const location = (res: Response) => new URL(res.headers.get("location") ?? "");

test("github connect: connect your account once, then linking a repo adds, updates and removes its webhook", async () => {
	const owner = await makeUser("ghc-owner", false);
	const member = await makeUser("ghc-member", false);
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const project = (await gql(owner, `query($s: String!) { workspace(slug: $s) { projects { id } } }`, { s: slug })).data?.workspace.projects[0];

	// connecting: off to GitHub, asking only for webhooks, and back only to this site
	assert.equal((await get(githubConnect, null, "/api/github/connect")).status, 401);
	const go = location(await get(githubConnect, owner, `/api/github/connect?back=${encodeURIComponent("//evil.com/x")}`));
	assert.equal(go.origin + go.pathname, "https://github.com/login/oauth/authorize");
	assert.equal(go.searchParams.get("scope"), "admin:repo_hook");
	const state = go.searchParams.get("state") ?? "";
	const back = (user: TestUser, s: string, code = "good") =>
		get(githubCallback, user, `/api/github/callback?${new URLSearchParams({ state: s, code })}`);

	// the state can't be forged, or used by someone else
	assert.equal((await back(owner, `${state.split(".")[0]}.forged`)).status, 400);
	assert.equal((await back(member, state)).status, 401);
	assert.equal(location(await back(owner, state, "bad")).searchParams.get("github"), "failed");

	const done = location(await back(owner, state));
	assert.equal(done.pathname, "/", "a path to another site goes home instead");
	assert.equal(done.searchParams.get("github"), "account");
	const [row] = await db.select().from(tables.github_account).where(eq(tables.github_account.user_id, owner.id));
	assert.equal(row.login, "octo");
	assert.ok(!row.token.includes("gho_secret_token"), "the token is stored sealed");

	const ACCOUNT = `{ githubAccount { login repos } }`;
	assert.deepEqual((await gql(owner, ACCOUNT)).data?.githubAccount, { login: "octo", repos: ["octo/mine"] });
	assert.equal((await gql(member, ACCOUNT)).data?.githubAccount, null, "someone else's account isn't yours");

	// linking adds the webhook on GitHub
	const CONNECT = `mutation($s: String!, $p: ID!, $r: String!) { connectGitHub(slug: $s, projectId: $p, repo: $r) { repo webhookUrl secret } }`;
	calls.length = 0;
	const link = (await gql(owner, CONNECT, { s: slug, p: project.id, r: "octo/mine" })).data?.connectGitHub;
	const added = calls.find((c) => c.method === "POST");
	assert.equal(added?.url, "https://api.github.com/repos/octo/mine/hooks");
	assert.deepEqual(added?.body?.events, ["pull_request"]);
	assert.deepEqual(added?.body?.config, { url: link.webhookUrl, content_type: "json", secret: link.secret, insecure_ssl: "0" });

	// again: the same webhook gets the new secret instead of a second one
	calls.length = 0;
	const again = (await gql(owner, CONNECT, { s: slug, p: project.id, r: "octo/mine" })).data?.connectGitHub;
	const patched = calls.find((c) => c.method === "PATCH");
	assert.equal(patched?.url, "https://api.github.com/repos/octo/mine/hooks/1");
	assert.equal((patched?.body?.config as { secret: string }).secret, again.secret);

	// no admin access on GitHub: an error, and the earlier link stays as it was
	admin = false;
	const LINK = `query($s: String!, $p: ID!) { projectGitHub(slug: $s, projectId: $p) { repo secret } }`;
	assert.match((await gql(owner, CONNECT, { s: slug, p: project.id, r: "other/theirs" })).errors?.[0].message ?? "", /admin access/);
	assert.deepEqual((await gql(owner, LINK, { s: slug, p: project.id })).data?.projectGitHub, { repo: "octo/mine", secret: again.secret });
	admin = true;

	// unlinking takes the webhook off the repo
	calls.length = 0;
	await gql(owner, `mutation($s: String!, $p: ID!) { disconnectGitHub(slug: $s, projectId: $p) }`, { s: slug, p: project.id });
	assert.ok(calls.some((c) => c.method === "DELETE" && c.url === "https://api.github.com/repos/octo/mine/hooks/1"));

	// disconnecting the account forgets it and revokes Zadaci on GitHub
	calls.length = 0;
	assert.equal((await gql(owner, `mutation { disconnectGitHubAccount }`)).data?.disconnectGitHubAccount, true);
	assert.ok(calls.some((c) => c.method === "DELETE" && c.url.endsWith("/applications/test-client/grant")));
	assert.equal((await gql(owner, ACCOUNT)).data?.githubAccount, null);
});
