import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, test } from "node:test";
import { db, tables } from "#/db";
import { sealKey } from "#/lib/ai/keys.server";
import { githubAppWebhook } from "#/lib/github.server";
import { cleanup, gql, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

// The Zadaci GitHub App: installed on the repos people choose (private too); its one webhook brings
// their pull requests. GitHub is faked here: no request leaves the machine.
process.env.GITHUB_CLIENT_ID = "app-client";
process.env.GITHUB_CLIENT_SECRET = "app-secret";
process.env.GITHUB_APP_SLUG = "zadaci-test";
process.env.GITHUB_APP_WEBHOOK_SECRET = "app-webhook-secret";

const calls: { url: string; method: string }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
	const url = String(input);
	if (!url.startsWith("https://api.github.com/") && !url.startsWith("https://github.com/")) return realFetch(input, init);
	calls.push({ url, method: init?.method ?? "GET" });
	// a token GitHub no longer accepts (expired, or from the old OAuth app)
	if (new Headers(init?.headers).get("authorization") === "Bearer ghu_expired") return new Response("Bad credentials", { status: 401 });
	if (url.includes("/user/installations?")) return Response.json({ installations: [{ id: 7 }] });
	if (url.includes("/user/installations/7/repositories"))
		return Response.json({ repositories: [{ full_name: "octo/secret-plans" }, { full_name: "octo/website" }] });
	return new Response("Not Found", { status: 404 });
}) as typeof fetch;
after(() => {
	globalThis.fetch = realFetch;
});

const deliver = (payload: object, secret = "app-webhook-secret", event = "pull_request") => {
	const body = JSON.stringify(payload);
	return githubAppWebhook(
		new Request("http://localhost:3000/api/github/app", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-github-event": event,
				"x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
			},
			body,
		}),
	);
};
const pr = (repo: string, title: string, merged = false) => ({
	action: merged ? "closed" : "opened",
	repository: { full_name: repo },
	pull_request: { number: 3, title, body: null, html_url: `https://github.com/${repo}/pull/3`, state: merged ? "closed" : "open", merged, head: { ref: "x" } },
});

test("github app: private repos it's installed on can be linked, and its one webhook brings their PRs", async () => {
	const owner = await makeUser("gha-owner", false);
	const { slug } = await makeWorkspace(owner);
	const project = (await gql(owner, `query($s: String!) { workspace(slug: $s) { projects { id } } }`, { s: slug })).data?.workspace.projects[0];
	const task = (await gql(owner, `mutation($s: String!, $i: TaskInput!) { createTask(slug: $s, input: $i) { id key } }`, { s: slug, i: { projectId: project.id, title: "Billing" } })).data?.createTask;
	await db.insert(tables.github_account).values({ user_id: owner.id, login: "octo", token: sealKey("ghu_fake", owner.id, "github") });

	// the list is the app's repos, private ones included, and there's a link to install it on more
	const ACCOUNT = `{ githubAppInstallUrl githubAccount { repos } }`;
	const data = (await gql(owner, ACCOUNT)).data;
	assert.equal(data?.githubAppInstallUrl, "https://github.com/apps/zadaci-test/installations/new");
	assert.deepEqual(data?.githubAccount.repos, ["octo/secret-plans", "octo/website"]);

	// only a repo the app is installed on (that they can see) links
	const CONNECT = `mutation($s: String!, $p: ID!, $r: String!) { connectGitHub(slug: $s, projectId: $p, repo: $r) { repo viaApp } }`;
	assert.match((await gql(owner, CONNECT, { s: slug, p: project.id, r: "someone/else" })).errors?.[0].message ?? "", /Install the Zadaci GitHub App/);
	calls.length = 0;
	const link = (await gql(owner, CONNECT, { s: slug, p: project.id, r: "octo/secret-plans" })).data?.connectGitHub;
	assert.deepEqual(link, { repo: "octo/secret-plans", viaApp: true });
	assert.ok(!calls.some((c) => c.url.includes("/hooks")), "no webhook is added to the repo");

	// its webhook: signed with the app's secret, routed to the projects that linked the repo
	const opened = pr("octo/secret-plans", `Invoices (${task.key})`);
	assert.equal((await deliver(opened, "wrong")).status, 401);
	assert.deepEqual(await (await deliver(opened)).json(), { linked: 1, completed: 0 });
	assert.deepEqual(await (await deliver(pr("octo/website", `Invoices (${task.key})`))).json(), { linked: 0, completed: 0 }, "a repo no project linked");
	assert.deepEqual(await (await deliver(pr("octo/secret-plans", `Invoices (${task.key})`, true))).json(), { linked: 1, completed: 1 });
	const t = (await gql(owner, `query($s: String!, $id: ID!) { workspace(slug: $s) { task(id: $id) { status githubPrs { state } } } }`, { s: slug, id: task.id })).data?.workspace.task;
	assert.equal(t.status, "completed");
	assert.equal(t.githubPrs[0].state, "merged");

	// unlinking touches nothing on GitHub (there's no webhook of ours on the repo)
	calls.length = 0;
	await gql(owner, `mutation($s: String!, $p: ID!) { disconnectGitHub(slug: $s, projectId: $p) }`, { s: slug, p: project.id });
	assert.ok(!calls.some((c) => c.url.includes("/hooks")));
	assert.deepEqual(await (await deliver(opened)).json(), { linked: 0, completed: 0 }, "nothing arrives once unlinked");
});

test("github app: a token GitHub refuses asks you to reconnect, instead of showing no repos", async () => {
	const me = await makeUser("gha-expired", false);
	const { slug } = await makeWorkspace(me);
	const project = (await gql(me, `query($s: String!) { workspace(slug: $s) { projects { id } } }`, { s: slug })).data?.workspace.projects[0];
	await db.insert(tables.github_account).values({ user_id: me.id, login: "octo", token: sealKey("ghu_expired", me.id, "github") });

	assert.deepEqual((await gql(me, `{ githubAccount { repos needsReconnect } }`)).data?.githubAccount, { repos: [], needsReconnect: true });
	const linked = await gql(me, `mutation($s: String!, $p: ID!) { connectGitHub(slug: $s, projectId: $p, repo: "octo/secret-plans") { repo } }`, { s: slug, p: project.id });
	assert.match(linked.errors?.[0].message ?? "", /Reconnect GitHub/, "not a misleading 'install the app' message");
});
