import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, mock, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { sealKey } from "#/lib/ai/keys.server";
import { withEmails } from "#/lib/email.server";
import { run } from "#/lib/ai/gql.server";
import { githubAppWebhook } from "#/lib/github.server";
import { githubSyncSettled, syncAllLinkedProjects, syncLinkedProject, syncTask } from "#/lib/github-sync.server";
import { cleanup, gql, makeUser, makeWorkspace, type TestUser } from "./helpers";

after(cleanup);

// Tasks ↔ GitHub issues for a project linked through the GitHub App, both ways. GitHub is faked
// here: no request leaves the machine.
process.env.GITHUB_CLIENT_ID = "app-client";
process.env.GITHUB_CLIENT_SECRET = "app-secret";
process.env.GITHUB_APP_SLUG = "zadaci-test";
process.env.GITHUB_APP_WEBHOOK_SECRET = "app-webhook-secret";
process.env.GITHUB_SYNC_PAUSE_MS = "0";

type Call = { method: string; path: string; body?: Record<string, unknown> };
const calls: Call[] = [];
let next = 100;
const failOnce = new Set<string>();
// GitHub makes boards for organizations' apps; on a personal account it refuses
let boards = false;
const OPTIONS = [
	{ id: "o-todo", name: "Todo" },
	{ id: "o-progress", name: "In Progress" },
	{ id: "o-done", name: "Done" },
];
function boardApi(query: string, v: Record<string, string>) {
	if (!boards) return Response.json({ errors: [{ message: "Resource not accessible by integration" }] });
	if (query.includes("repository(")) return Response.json({ data: { repository: { id: "R_board", owner: { id: "U_octo" } } } });
	if (query.includes("createProjectV2"))
		return Response.json({
			data: { createProjectV2: { projectV2: { id: "PVT_1", url: "https://github.com/users/octo/projects/1", field: { id: "F_status", options: OPTIONS } } } },
		});
	if (query.includes("addProjectV2ItemById")) return Response.json({ data: { addProjectV2ItemById: { item: { id: `card-${v.c}` } } } });
	if (query.includes("updateProjectV2ItemFieldValue")) return Response.json({ data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: v.i } } } });
	if (query.includes("deleteProjectV2Item")) return Response.json({ data: { deleteProjectV2Item: { deletedItemId: v.i } } });
	return Response.json({ errors: [{ message: "unknown query" }] });
}
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
	const url = String(input);
	if (!url.startsWith("https://api.github.com/")) return realFetch(input, init);
	const method = init?.method ?? "GET";
	const path = url.replace("https://api.github.com", "");
	const body = init?.body ? JSON.parse(String(init.body)) : undefined;
	calls.push({ method, path, body });
	if (path === "/graphql") return boardApi(String(body?.query), body?.variables ?? {});
	if (method === "GET" && /\/issues\/\d+$/.test(path)) return Response.json({ node_id: `issue-${path.split("/").pop()}` });
	if (path.startsWith("/user/installations?")) return Response.json({ installations: [{ id: 7 }] });
	if (path.startsWith("/user/installations/7/repositories")) return Response.json({ repositories: [{ full_name: "octo/board" }] });
	if (method === "GET" && path.startsWith("/repos/octo/board/issues"))
		return Response.json([
			{ number: 41, title: "Existing bug", body: "Reported on GitHub", state: "open" },
			{ number: 42, title: "A pull request", body: null, state: "open", pull_request: {} },
		]);
	// GitHub's secondary rate limit, once, for whichever write is listed here
	if (failOnce.delete(`${method} ${path}`))
		return Response.json({ message: "You have exceeded a secondary rate limit" }, { status: 403 });
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
// issue writes (the board's GraphQL calls are checked on their own)
const writes = () => calls.filter((c) => c.method !== "GET" && c.path !== "/graphql");
const board = (mutation: string) => calls.filter((c) => c.path === "/graphql" && String(c.body?.query).includes(mutation));
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
	assert.ok(titles.includes("Shipped thing"), "a completed task gets an issue too…");
	const shipped = (await db.select().from(tables.task).where(eq(tables.task.name, "Shipped thing")))[0];
	const shippedIssue = (await issueOf(shipped.id)).number;
	assert.ok(
		writes().some((c) => c.method === "PATCH" && c.path === `/repos/octo/board/issues/${shippedIssue}` && c.body?.state === "closed" && c.body?.state_reason === "completed"),
		"…closed as completed",
	);
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
	await deliver("issues", { action: "opened", repository, issue: { number: 200, title: "Sign up", body: `… [Open in Zadaci](https://x/w/s/p/p?task=${signup})`, state: "open", user: { login: "octo" } } });
	assert.equal((await db.select().from(tables.task).where(eq(tables.task.project_id, project.id))).length, before);

	// someone else's issue quoting a task's link can't take that task over: it's just a new issue
	const signupIssue = (await issueOf(signup)).number;
	const signupBefore = (await db.select().from(tables.task).where(eq(tables.task.id, signup)))[0];
	await deliver("issues", { action: "opened", repository, issue: { number: 666, title: "Hijack", body: `[x](https://x/w/s/p/p?task=${signup})`, state: "open", user: { login: "stranger" } } });
	assert.equal((await issueOf(signup)).number, signupIssue, "the task keeps its own issue");
	await deliver("issues", { action: "closed", repository, issue: { number: 666, title: "Hijack", body: "", state: "closed", user: { login: "stranger" } } });
	const signupAfter = (await db.select().from(tables.task).where(eq(tables.task.id, signup)))[0];
	assert.deepEqual([signupAfter.name, signupAfter.status], [signupBefore.name, signupBefore.status], "their issue doesn't touch the task");

	// a change made through the MCP connector (Zad's tools, run as the person) updates the issue too
	const [me] = await db.select({ id: tables.user.id, email: tables.user.email, name: tables.user.name }).from(tables.user).where(eq(tables.user.id, owner.id));
	calls.length = 0;
	await run({ user: me, slug, today: "2026-11-04", edited: new Set(), asYou: true }, UPDATE.replace("$s", "$slug").replace("slug: $s", "slug: $slug"), { id: signup, p: { title: "Sign up via MCP" } });
	await githubSyncSettled();
	assert.deepEqual(writes().map((c) => [c.method, c.path, c.body?.title]), [["PATCH", "/repos/octo/board/issues/200", "Sign up via MCP"]]);

	// deleted on GitHub: the task goes too (restorable from the Archive)
	await deliver("issues", { action: "deleted", repository, issue: { number: 77, title: "Crash on save", body: null, state: "open" } });
	assert.ok((await task(crash.id)).deleted_at);
});

test("github sync: a write GitHub refuses is logged with its reason, the rest still sync, and the hourly job repairs it", async () => {
	const owner = await makeUser("ghs-retry", false);
	const { slug } = await makeWorkspace(owner);
	const project = (await gql(owner, `query($s: String!) { workspace(slug: $s) { projects { id } } }`, { s: slug })).data?.workspace.projects[0];
	const done = (await act(owner, CREATE, { s: slug, i: { projectId: project.id, title: "Finished early", status: "completed" } })).data?.createTask.id;
	await db.insert(tables.github_account).values({ user_id: owner.id, login: "octo", token: sealKey("ghu_fake", owner.id, "github") });

	// closing the completed task's new issue hits GitHub's rate limit
	next = 500;
	const firstNew = 500 + 6; // the sample project's 6 open tasks get 500–505 first
	failOnce.add(`PATCH /repos/octo/board/issues/${firstNew}`);
	const log = mock.method(console, "error", () => {});
	try {
		calls.length = 0;
		await act(owner, `mutation($s: String!, $p: ID!) { connectGitHub(slug: $s, projectId: $p, repo: "octo/board") { viaApp } }`, { s: slug, p: project.id });
		assert.ok(log.mock.calls.some((c) => c.arguments.join(" ").includes("secondary rate limit")), "GitHub's reason is logged");
	} finally {
		log.mock.restore();
	}
	assert.ok(writes().filter((c) => c.method === "POST").length >= 7, "the other tasks still got their issues");
	const issueOf = async (taskId: string) =>
		(await db.select().from(tables.task_github_issue).where(eq(tables.task_github_issue.task_id, taskId)))[0];
	assert.equal((await issueOf(done)).number, firstNew, "its issue exists, but wasn't closed");

	// the hourly job finishes it on its own: the completed task's issue gets closed, nothing is duplicated
	calls.length = 0;
	await syncAllLinkedProjects();
	const mine = writes().filter((c) => c.path.startsWith("/repos/octo/board/"));
	assert.ok(mine.some((c) => c.method === "PATCH" && c.path === `/repos/octo/board/issues/${firstNew}` && c.body?.state === "closed"));
	assert.equal(mine.filter((c) => c.method === "POST").length, 0, "no new issues for tasks that already have one");
	// Sync now does the same by hand, and finds nothing left to do
	calls.length = 0;
	await act(owner, `mutation($s: String!, $p: ID!) { syncGitHub(slug: $s, projectId: $p) }`, { s: slug, p: project.id });
	assert.equal(writes().filter((c) => c.path.startsWith("/repos/octo/board/")).length, 0);
});

test("github board: linking makes the repo a board with every task's issue in its status's column, and keeps it in step", async () => {
	boards = true;
	try {
		const owner = await makeUser("ghs-board", false);
		const { slug } = await makeWorkspace(owner);
		const project = (await gql(owner, `query($s: String!) { workspace(slug: $s) { projects { id title } } }`, { s: slug })).data?.workspace.projects[0];
		await db.insert(tables.github_account).values({ user_id: owner.id, login: "octo", token: sealKey("ghu_fake", owner.id, "github") });
		const shipped = (await act(owner, CREATE, { s: slug, i: { projectId: project.id, title: "Shipped", status: "completed" } })).data?.createTask.id;
		calls.length = 0;
		const linked = await act(owner, `mutation($s: String!, $p: ID!) { connectGitHub(slug: $s, projectId: $p, repo: "octo/board") { viaApp } }`, { s: slug, p: project.id });
		assert.equal(linked.errors, undefined);
		const [made] = board("createProjectV2");
		assert.deepEqual(made.body?.variables, { o: "U_octo", r: "R_board", t: project.title }, "owned by the repo's owner, linked to the repo, named after the project");
		const issues = await db.select().from(tables.task_github_issue).where(eq(tables.task_github_issue.repo, "octo/board"));
		const mine = issues.filter((i) => i.card);
		assert.ok(mine.length >= 7, "every task's issue is on the board");
		assert.equal((await db.select().from(tables.task_github_issue).where(eq(tables.task_github_issue.task_id, shipped)))[0].card_status, "Done");
		const shown = await gql(owner, `query($s: String!, $p: ID!) { projectGitHub(slug: $s, projectId: $p) { boardUrl boardError } }`, { s: slug, p: project.id });
		assert.deepEqual(shown.data?.projectGitHub, { boardUrl: "https://github.com/users/octo/projects/1", boardError: null });

		// a status change moves the card; nothing is added twice
		const task = (await act(owner, CREATE, { s: slug, i: { projectId: project.id, title: "Board me" } })).data?.createTask.id;
		calls.length = 0;
		await act(owner, UPDATE, { s: slug, id: task, p: { status: "in_progress" } });
		assert.equal(board("addProjectV2ItemById").length, 0);
		assert.deepEqual(board("updateProjectV2ItemFieldValue").map((c) => (c.body?.variables as Record<string, string>).o), ["o-progress"]);
		// syncing again finds the board in step: no writes at all
		calls.length = 0;
		await syncLinkedProject(project.id);
		assert.equal(writes().length, 0);
		for (const m of ["createProjectV2", "addProjectV2ItemById", "updateProjectV2ItemFieldValue"]) assert.equal(board(m).length, 0, m);
		// a deleted task's card comes off the board
		calls.length = 0;
		await act(owner, `mutation($s: String!, $ids: [ID!]!) { deleteTasks(slug: $s, ids: $ids) }`, { s: slug, ids: [task] });
		assert.equal(board("deleteProjectV2Item").length, 1);
	} finally {
		boards = false;
	}
});

test("github board: on a personal account GitHub refuses the board; the window says why and issues still sync", async () => {
	const owner = await makeUser("ghs-noboard", false);
	const { slug } = await makeWorkspace(owner);
	const project = (await gql(owner, `query($s: String!) { workspace(slug: $s) { projects { id } } }`, { s: slug })).data?.workspace.projects[0];
	await db.insert(tables.github_account).values({ user_id: owner.id, login: "octo", token: sealKey("ghu_fake", owner.id, "github") });
	calls.length = 0;
	await act(owner, `mutation($s: String!, $p: ID!) { connectGitHub(slug: $s, projectId: $p, repo: "octo/board") { viaApp } }`, { s: slug, p: project.id });
	const shown = await gql(owner, `query($s: String!, $p: ID!) { projectGitHub(slug: $s, projectId: $p) { boardUrl boardError } }`, { s: slug, p: project.id });
	assert.equal(shown.data?.projectGitHub.boardUrl, null);
	assert.match(shown.data?.projectGitHub.boardError ?? "", /personal accounts/);
	assert.ok(writes().filter((c) => c.method === "POST").length >= 6, "issues were still opened");
});

test("github sync: two syncs at once open one issue for a task, and import each issue once", async () => {
	const owner = await makeUser("ghs-race", false);
	const { slug } = await makeWorkspace(owner);
	const project = (await gql(owner, `query($s: String!) { workspace(slug: $s) { projects { id } } }`, { s: slug })).data?.workspace.projects[0];
	await db.insert(tables.github_account).values({ user_id: owner.id, login: "octo", token: sealKey("ghu_fake", owner.id, "github") });
	const task = (await gql(owner, CREATE, { s: slug, i: { projectId: project.id, title: "Race me" } })).data?.createTask.id;
	// linked afterwards (once the create's own queued sync is done), so the task has no issue yet
	await githubSyncSettled();
	await db.insert(tables.project_github).values({ project_id: project.id, repo: "octo/board", nonce: "n", via_app: true, connected_by: owner.id });

	// a quick second edit and the hourly run reach the task together
	calls.length = 0;
	await Promise.all([syncTask(task), syncTask(task), syncTask(task)]);
	const posts = writes().filter((c) => c.method === "POST" && c.body?.title === "Race me");
	assert.equal(posts.length, 1, "one issue, not three");
	const rows = await db.select().from(tables.task_github_issue).where(eq(tables.task_github_issue.task_id, task));
	assert.equal(rows.length, 1);
	assert.ok(rows[0].number, "its number is saved");

	// linking (or Sync now) and the hourly run overlap: the repo's issue #41 becomes one task
	await Promise.all([syncLinkedProject(project.id), syncLinkedProject(project.id)]);
	const imported = await db
		.select()
		.from(tables.task)
		.where(and(eq(tables.task.project_id, project.id), eq(tables.task.name, "Existing bug")));
	// (another test's project may have imported #41 from the same fake repo already)
	assert.ok(imported.length <= 1, "never two copies");
	const [link] = await db.select().from(tables.project_github).where(eq(tables.project_github.project_id, project.id));
	assert.equal(link.sync_until, null, "the claim is let go when the sync ends");
});

test("github sync: a run that hits its time limit stops, says so, and leaves the rest for the next run", async () => {
	const owner = await makeUser("ghs-deadline", false);
	const { slug } = await makeWorkspace(owner);
	const project = (await gql(owner, `query($s: String!) { workspace(slug: $s) { projects { id } } }`, { s: slug })).data?.workspace.projects[0];
	await db.insert(tables.github_account).values({ user_id: owner.id, login: "octo", token: sealKey("ghu_fake", owner.id, "github") });
	await githubSyncSettled();
	await db.insert(tables.project_github).values({ project_id: project.id, repo: "octo/board", nonce: "n2", via_app: true, connected_by: owner.id });
	calls.length = 0;
	// Vercel would stop the function: past its deadline, the run starts nothing new
	assert.equal(await syncLinkedProject(project.id, Date.now() - 1), "stopped");
	assert.equal(writes().filter((c) => c.method === "POST").length, 0);
	const result = await syncAllLinkedProjects(Date.now() - 1);
	assert.ok(result.unfinished >= 1 && result.unfinished <= result.linked, JSON.stringify(result));
	// with time to spare, the next run finishes it
	assert.equal(await syncLinkedProject(project.id), "done");
	assert.ok(writes().filter((c) => c.method === "POST").length >= 6, "the sample project's tasks got their issues");
});

test("github sync: a deleted task whose close GitHub refused gets its issue closed by the next repair", async () => {
	const owner = await makeUser("ghs-gone", false);
	const { slug } = await makeWorkspace(owner);
	const project = (await gql(owner, `query($s: String!) { workspace(slug: $s) { projects { id } } }`, { s: slug })).data?.workspace.projects[0];
	await db.insert(tables.github_account).values({ user_id: owner.id, login: "octo", token: sealKey("ghu_fake", owner.id, "github") });
	await act(owner, `mutation($s: String!, $p: ID!) { connectGitHub(slug: $s, projectId: $p, repo: "octo/board") { viaApp } }`, { s: slug, p: project.id });
	const task = (await act(owner, CREATE, { s: slug, i: { projectId: project.id, title: "Short-lived" } })).data?.createTask.id;
	const { number } = (await db.select().from(tables.task_github_issue).where(eq(tables.task_github_issue.task_id, task)))[0];

	// GitHub refuses the close once (a rate limit)
	failOnce.add(`PATCH /repos/octo/board/issues/${number}`);
	const log = mock.method(console, "error", () => {});
	try {
		await act(owner, `mutation($s: String!, $ids: [ID!]!) { deleteTasks(slug: $s, ids: $ids) }`, { s: slug, ids: [task] });
	} finally {
		log.mock.restore();
	}
	calls.length = 0;
	await syncLinkedProject(project.id);
	assert.ok(
		writes().some((c) => c.method === "PATCH" && c.path === `/repos/octo/board/issues/${number}` && c.body?.state === "closed"),
		"the repair closed it",
	);
});
