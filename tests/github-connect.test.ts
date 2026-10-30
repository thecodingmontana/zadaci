import assert from "node:assert/strict";
import { after, test } from "node:test";
import { githubCallback, githubConnect } from "#/lib/github-connect.server";
import { cleanup, gql, join, makeUser, makeWorkspace, type TestUser } from "./helpers";

after(cleanup);

// "Connect with GitHub": sign in to GitHub once and we add the repo's webhook. GitHub itself is
// faked here: no request leaves the machine.
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
		return Response.json(body.code === "good" ? { access_token: "gho_test" } : { error: "bad_verification_code" });
	if (!admin) return new Response("Not Found", { status: 404 });
	if (method === "GET") return Response.json(hooks);
	if (method === "POST") {
		hooks = [{ id: 1, config: { url: body.config.url } }];
		return Response.json(hooks[0], { status: 201 });
	}
	return Response.json(hooks[0]);
}) as typeof fetch;
after(() => {
	globalThis.fetch = realFetch;
});

const get = (fn: (r: Request) => Promise<Response>, user: TestUser | null, path: string) =>
	fn(new Request(`http://localhost:3000${path}`, { headers: user ? { cookie: user.cookie } : {} }));
const result = (res: Response) => new URL(res.headers.get("location") ?? "").searchParams.get("github");

test("github connect: approving on GitHub links the project and adds (then updates) its webhook", async () => {
	const owner = await makeUser("ghc-owner", false);
	const member = await makeUser("ghc-member", false);
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const project = (await gql(owner, `query($s: String!) { workspace(slug: $s) { projects { id } } }`, { s: slug })).data?.workspace.projects[0];
	const start = (user: TestUser | null, repo = "acme/shop") =>
		get(githubConnect, user, `/api/github/connect?${new URLSearchParams({ slug, projectId: project.id, repo })}`);

	assert.equal((await start(null)).status, 401);
	assert.equal(result(await start(member)), "denied", "only full access may link");
	assert.equal(result(await start(owner, "not a repo")), "bad-repo");

	const go = await start(owner);
	const to = new URL(go.headers.get("location") ?? "");
	assert.equal(to.origin + to.pathname, "https://github.com/login/oauth/authorize");
	assert.equal(to.searchParams.get("scope"), "admin:repo_hook");
	const state = to.searchParams.get("state") ?? "";
	const back = (user: TestUser, s: string, code = "good") =>
		get(githubCallback, user, `/api/github/callback?${new URLSearchParams({ state: s, code })}`);

	// the state can't be forged, or used by someone else
	assert.equal((await back(owner, `${state.split(".")[0]}.forged`)).status, 400);
	assert.equal((await back(member, state)).status, 401);
	assert.equal(result(await back(owner, state, "bad")), "failed");

	// no admin access on GitHub: nothing is linked
	admin = false;
	assert.equal(result(await back(owner, state)), "no-access");
	const LINK = `query($s: String!, $p: ID!) { projectGitHub(slug: $s, projectId: $p) { repo webhookUrl secret } }`;
	assert.equal((await gql(owner, LINK, { s: slug, p: project.id })).data?.projectGitHub, null);

	admin = true;
	calls.length = 0;
	assert.equal(result(await back(owner, state)), "connected");
	const link = (await gql(owner, LINK, { s: slug, p: project.id })).data?.projectGitHub;
	assert.equal(link.repo, "acme/shop");
	const added = calls.find((c) => c.method === "POST" && c.url.startsWith("https://api.github.com/"));
	assert.equal(added?.url, "https://api.github.com/repos/acme/shop/hooks");
	assert.deepEqual(added?.body?.events, ["pull_request"]);
	assert.deepEqual(added?.body?.config, { url: link.webhookUrl, content_type: "json", secret: link.secret, insecure_ssl: "0" });

	// connecting again updates the same webhook with the new secret instead of adding another
	calls.length = 0;
	assert.equal(result(await back(owner, state)), "connected");
	const again = (await gql(owner, LINK, { s: slug, p: project.id })).data?.projectGitHub;
	const patched = calls.find((c) => c.method === "PATCH");
	assert.equal(patched?.url, "https://api.github.com/repos/acme/shop/hooks/1");
	assert.equal((patched?.body?.config as { secret: string }).secret, again.secret);
	assert.notEqual(again.secret, link.secret);
});
