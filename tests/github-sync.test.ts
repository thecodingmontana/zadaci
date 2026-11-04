import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { sealKey } from "#/lib/ai/keys.server";
import { withEmails } from "#/lib/email.server";
import { githubAppWebhook } from "#/lib/github.server";
import { githubSyncSettled, syncTask } from "#/lib/github-sync.server";
import { cleanup, gql, makeUser, makeWorkspace, type TestUser } from "./helpers";

after(cleanup);

// Tasks ↔ GitHub issues for a project linked through the GitHub App, both ways. GitHub is faked
// here: no request leaves the machine.
process.env.GITHUB_CLIENT_ID = "app-client";
process.env.GITHUB_CLIENT_SECRET = "app-secret";
process.env.GITHUB_APP_SLUG = "zadaci-test";
process.env.GITHUB_APP_WEBHOOK_SECRET = "app-webhook-secret";

type Call = { method: string; path: string; body?: Record<string, unknown> };
const calls: Call[] = [];
let next = 100;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
	const url = String(input);
	if (!url.startsWith("https://api.github.com/")) return realFetch(input, init);
	const method = init?.method ?? "GET";
	const path = url.replace("https://api.github.com", "");
	const body = init?.body ? JSON.parse(String(init.body)) : undefined;
	calls.push({ method, path, body });
	if (path.startsWith("/user/installations?")) return Response.json({ installations: [{ id: 7 }] });
	if (path.startsWith("/user/installations/7/repositories")) return Response.json({ repositories: [{ full_name: "octo/board" }] });
	if (method === "GET" && path.startsWith("/repos/octo/board/issues"))
		return Response.json([
			{ number: 41, title: "Existing bug", body: "Reported on GitHub", state: "open" },
			{ number: 42, title: "A pull request", body: null, state: "open", pull_request: {} },
		]);
	if (method === "POST") return Response.json({ number: next++ }, { status: 201 });
	if (method === "PATCH") return Response.json({ number: Number(path.split("/").pop()) });
	return new Response("Not Found", { status: 404 });
}) as typeof fetch;
after(() => {
	globalThis.fetch = realFetch;
});

// like a request to /api/graphql: GitHub writes go out once its changes are saved
const act = async (user: TestUser, query: string, variables: Record<string, unknown>) => {
	const res = await withEmails(() => gql(user, query, variables));
	await githubSyncSettled();
	return res;
};
// like GitHub calling the app's webhook
const deliver = async (event: string, payload: object) => {
	const body = JSON.stringify(payload);
	const res = await withEmails(() =>
		githubAppWebhook(
			new Request("http://localhost:3000/api/github/app", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-github-event": event,
					"x-hub-signature-256": `sha256=${createHmac("sha256", "app-webhook-secret").update(body).digest("hex")}`,
				},
				body,
			}),
		),
	);
	await githubSyncSettled();
	return res.json();
};
const writes = () => calls.filter((c) => c.method !== "GET");
const CREATE = `mutation($s: String!, $i: TaskInput!) { createTask(slug: $s, input: $i) { id } }`;
const UPDATE = `mutation($s: String!, $id: ID!, $p: TaskPatch!) { updateTask(slug: $s, id: $id, patch: $p) { id } }`;

test("github sync: linking imports open issues and opens issues for open tasks; task changes follow", async () => {
	const owner = await makeUser("ghs-owner", false);
	const { slug } = await makeWorkspace(owner);
	const project = (await gql(owner, `query($s: String!) { workspace(slug: $s) { projects { id } } }`, { s: slug })).data?.workspace.projects[0];
	const login = (await act(owner, CREATE, { s: slug, i: { projectId: project.id, title: "Login page", status: "todo" } })).data?.createTask.id;
	await act(owner, CREATE, { s: slug, i: { projectId: project.id, title: "Shipped thing", status: "completed" } });
	assert.equal(writes().length, 0, "nothing goes to GitHub before the project is linked");
	await db.insert(tables.github_account).values({ user_id: owner.id, login: "octo", token: sealKey("ghu_fake", owner.id, "github") });

	// link: the open issue becomes a task (the pull request doesn't), open tasks get issues
	calls.length = 0;
	await act(owner, `mutation($s: String!, $p: ID!) { connectGitHub(slug: $s, projectId: $p, repo: "octo/board") { viaApp } }`, { s: slug, p: project.id });
	const issueOf = async (taskId: string) =>
		(await db.select().from(tables.task_github_issue).where(eq(tables.task_github_issue.task_id, taskId)))[0];
	const imported = (await db.select().from(tables.task).where(eq(tables.task.name, "Existing bug")))[0];
	assert.equal(imported?.description, "Reported on GitHub");
	assert.equal((await issueOf(imported.id)).number, 41);
	assert.ok(writes().some((c) => c.method === "PATCH" && c.path === "/repos/octo/board/issues/41"), "the imported issue gets its Zadaci link");
	const opened = writes().filter((c) => c.method === "POST");
	const titles = opened.map((c) => c.body?.title);
	assert.ok(titles.includes("Login page"), "open tasks get issues (the sample project's too)");
	assert.ok(!titles.includes("Shipped thing"), "a completed task gets no issue");
	assert.equal((await db.select().from(tables.task).where(eq(tables.task.name, "A pull request"))).length, 0, "a pull request gets no task");
	assert.match(String(opened.at(-1)?.body?.body), /Open in Zadaci/);
	const loginIssue = (await issueOf(login)).number;
	next = 200;

	// a new task opens an issue; renaming it edits that issue
	calls.length = 0;
	const signup = (await act(owner, CREATE, { s: slug, i: { projectId: project.id, title: "Signup", status: "todo" } })).data?.createTask.id;
	assert.deepEqual(writes().map((c) => [c.method, c.body?.title]), [["POST", "Signup"]]);
	calls.length = 0;
	await act(owner, UPDATE, { s: slug, id: signup, p: { title: "Sign up" } });
	assert.deepEqual(writes().map((c) => [c.method, c.path, c.body?.title]), [["PATCH", "/repos/octo/board/issues/200", "Sign up"]]);

	// nothing changed: no call
	calls.length = 0;
	await syncTask(signup);
	assert.equal(writes().length, 0);

	// completing closes it as completed; deleting another closes it as not planned; restoring reopens
	await act(owner, UPDATE, { s: slug, id: signup, p: { status: "completed" } });
	assert.deepEqual([writes().at(-1)?.body?.state, writes().at(-1)?.body?.state_reason], ["closed", "completed"]);
	calls.length = 0;
	await act(owner, `mutation($s: String!, $ids: [ID!]!) { deleteTasks(slug: $s, ids: $ids) }`, { s: slug, ids: [login] });
	assert.deepEqual([writes()[0]?.path, writes()[0]?.body?.state, writes()[0]?.body?.state_reason], [`/repos/octo/board/issues/${loginIssue}`, "closed", "not_planned"]);
	calls.length = 0;
	await act(owner, `mutation($s: String!, $ids: [ID!]!) { restoreTasks(slug: $s, ids: $ids) }`, { s: slug, ids: [login] });
	assert.deepEqual([writes()[0]?.path, writes()[0]?.body?.state], [`/repos/octo/board/issues/${loginIssue}`, "open"]);

	// ── GitHub → Zadaci ──
	const repository = { full_name: "octo/board" };
	const task = async (id: string) => (await db.select().from(tables.task).where(eq(tables.task.id, id)))[0];

	// our own write coming back (exactly what we sent) changes nothing
	const ours = writes()[0];
	calls.length = 0;
	assert.deepEqual(
		await deliver("issues", { action: "reopened", repository, issue: { number: loginIssue, title: ours.body?.title, body: ours.body?.body, state: "open" } }),
		{ changed: 0 },
	);

	// edited on GitHub: the task's title and description follow, and nothing is written back
	assert.deepEqual(
		await deliver("issues", { action: "edited", repository, issue: { number: loginIssue, title: "Login page v2", body: "New details\n\n---\nALP-1 · [Open in Zadaci](x)", state: "open" } }),
		{ changed: 1 },
	);
	assert.equal((await task(login)).name, "Login page v2");
	assert.equal((await task(login)).description, "New details", "the Zadaci footer isn't copied into the task");
	assert.equal(writes().length, 0, "no echo back to GitHub");

	// closed and reopened on GitHub
	await deliver("issues", { action: "closed", repository, issue: { number: loginIssue, title: "Login page v2", body: "x", state: "closed" } });
	assert.equal((await task(login)).status, "completed");
	await deliver("issues", { action: "reopened", repository, issue: { number: loginIssue, title: "Login page v2", body: "y", state: "open" } });
	assert.equal((await task(login)).status, "todo");

	// opened on GitHub: a new task, which gets its Zadaci link written back
	calls.length = 0;
	assert.deepEqual(await deliver("issues", { action: "opened", repository, issue: { number: 77, title: "Crash on save", body: "Steps…", state: "open" } }), { changed: 1 });
	const crash = (await db.select().from(tables.task).where(eq(tables.task.name, "Crash on save")))[0];
	assert.equal((await issueOf(crash.id)).number, 77);
	assert.ok(writes().some((c) => c.method === "PATCH" && c.path === "/repos/octo/board/issues/77"));

	// "opened" for an issue we opened ourselves (GitHub can say so before we saved its number): no copy
	const before = (await db.select().from(tables.task).where(eq(tables.task.project_id, project.id))).length;
	await deliver("issues", { action: "opened", repository, issue: { number: 200, title: "Sign up", body: `… [Open in Zadaci](https://x/w/s/p/p?task=${signup})`, state: "open" } });
	assert.equal((await db.select().from(tables.task).where(eq(tables.task.project_id, project.id))).length, before);

	// deleted on GitHub: the task goes too (restorable from the Archive)
	await deliver("issues", { action: "deleted", repository, issue: { number: 77, title: "Crash on save", body: null, state: "open" } });
	assert.ok((await task(crash.id)).deleted_at);
});
