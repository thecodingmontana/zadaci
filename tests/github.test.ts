import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, test } from "node:test";
import { githubWebhook, taskNumbers } from "#/lib/github.server";
import { cleanup, gql, join, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

// GitHub → Zadaci: PRs that mention a task's key show on it; merging completes it.
const deliver = (projectId: string, secret: string, event: string, payload: object, sign = true) => {
	const body = JSON.stringify(payload);
	return githubWebhook(
		projectId,
		new Request(`http://localhost:3000/api/github/${projectId}`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-github-event": event,
				...(sign ? { "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}` } : {}),
			},
			body,
		}),
	);
};
const pr = (repo: string, n: number, title: string, branch: string) => ({
	action: "opened",
	repository: { full_name: repo },
	pull_request: { number: n, title, body: null, html_url: `https://github.com/${repo}/pull/${n}`, state: "open", merged: false, head: { ref: branch } },
});

test("github: task keys are found in titles and branch names, and only whole keys", () => {
	assert.deepEqual(taskNumbers("PSA", "Fix login (PSA-4)", "psa-12-cart-page", "PSA-40X and XPSA-5"), [4, 12]);
});

test("github: a linked repo's PRs show on the tasks they mention, and merging completes them once", async () => {
	const owner = await makeUser("gh-owner", false);
	const member = await makeUser("gh-member", false);
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const project = (await gql(owner, `query($s: String!) { workspace(slug: $s) { projects { id } } }`, { s: slug })).data?.workspace.projects[0];
	const task = (await gql(owner, `mutation($s: String!, $i: TaskInput!) { createTask(slug: $s, input: $i) { id key } }`, { s: slug, i: { projectId: project.id, title: "Login page" } })).data?.createTask;
	const [key, num] = task.key.split("-");

	// only people with full access link a repo
	const CONNECT = `mutation($s: String!, $p: ID!, $r: String!) { connectGitHub(slug: $s, projectId: $p, repo: $r) { repo webhookUrl secret } }`;
	assert.ok((await gql(member, CONNECT, { s: slug, p: project.id, r: "acme/shop" })).errors?.length);
	const link = (await gql(owner, CONNECT, { s: slug, p: project.id, r: "https://github.com/acme/shop.git" })).data?.connectGitHub;
	assert.equal(link.repo, "acme/shop", "a pasted URL becomes owner/name");
	assert.match(link.webhookUrl, new RegExp(`/api/github/${project.id}$`));

	// unsigned, wrongly signed, or another repo: nothing happens
	const opened = pr("acme/shop", 12, `Login page (${key}-${num})`, `${key.toLowerCase()}-${num}-login`);
	assert.equal((await deliver(project.id, link.secret, "pull_request", opened, false)).status, 401);
	assert.equal((await deliver(project.id, "not-the-secret", "pull_request", opened)).status, 401);
	assert.equal((await deliver(project.id, link.secret, "pull_request", { ...opened, repository: { full_name: "evil/repo" } })).status, 400);

	assert.deepEqual(await (await deliver(project.id, link.secret, "pull_request", opened)).json(), { linked: 1, completed: 0 });
	const PRS = `query($s: String!, $id: ID!) { workspace(slug: $s) { task(id: $id) { status githubPrs { number state url } } } }`;
	let t = (await gql(owner, PRS, { s: slug, id: task.id })).data?.workspace.task;
	assert.deepEqual(t.githubPrs, [{ number: 12, state: "open", url: "https://github.com/acme/shop/pull/12" }]);

	const merged = { ...opened, action: "closed", pull_request: { ...opened.pull_request, state: "closed", merged: true } };
	assert.deepEqual(await (await deliver(project.id, link.secret, "pull_request", merged)).json(), { linked: 1, completed: 1 });
	t = (await gql(owner, PRS, { s: slug, id: task.id })).data?.workspace.task;
	assert.equal(t.status, "completed");
	assert.equal(t.githubPrs[0].state, "merged");
	// GitHub re-sends the same delivery: nothing more happens
	assert.deepEqual(await (await deliver(project.id, link.secret, "pull_request", merged)).json(), { linked: 1, completed: 0 });

	// reconnecting makes a new secret; the old one stops working
	const again = (await gql(owner, CONNECT, { s: slug, p: project.id, r: "acme/shop" })).data?.connectGitHub;
	assert.notEqual(again.secret, link.secret);
	assert.equal((await deliver(project.id, link.secret, "pull_request", opened)).status, 401);
});
