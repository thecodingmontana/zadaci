import assert from "node:assert/strict";
import { after, test } from "node:test";
import { cleanup, gql, join, makeUser, makeWorkspace, type TestUser } from "./helpers";

after(cleanup);

const code = (res: Awaited<ReturnType<typeof gql>>) => res.errors?.[0]?.extensions?.code;
const FIELDS = "id key status completedAt assigneeId dueDate labels subtaskCount subtaskDone commentCount dependsOn";
const CREATE = `mutation($s: String!, $i: TaskInput!) { createTask(slug: $s, input: $i) { ${FIELDS} } }`;
const UPDATE = `mutation($s: String!, $id: ID!, $p: TaskPatch!) { updateTask(slug: $s, id: $id, patch: $p) { ${FIELDS} } }`;
const TASKS = `query($s: String!, $p: ID) { workspace(slug: $s) { tasks(projectId: $p) { ${FIELDS} title: name } } }`;

async function setup() {
	const owner = await makeUser("owner");
	const member = await makeUser("member");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(member, inviteCode);
	const ws = (await gql(owner, `query($s: String!) { workspace(slug: $s) { members { id isMe } projects { id key } } }`, { s: slug })).data
		?.workspace;
	const project = ws.projects[0];
	const memberId = ws.members.find((m: { isMe: boolean }) => !m.isMe).id;
	const create = (user: TestUser, input: Record<string, unknown>) =>
		gql(user, CREATE, { s: slug, i: { projectId: project.id, ...input } });
	return { owner, member, slug, project, memberId, create };
}

test("new tasks get the next key, and assigning someone notifies them", async () => {
	const { owner, member, slug, project, memberId, create } = await setup();
	const starters = (await gql(owner, TASKS, { s: slug, p: project.id })).data?.workspace.tasks;
	assert.equal(starters.length, 6);
	assert.equal(starters[0].key, `${project.key}-1`, "starter tasks are numbered");

	const res = await create(owner, { title: "Write copy", assigneeId: memberId, labels: ["content"], dueDate: "2026-11-02" });
	const task = res.data?.createTask;
	assert.ok(task, JSON.stringify(res.errors));
	assert.equal(task.key, `${project.key}-7`);
	assert.equal(task.assigneeId, memberId);
	assert.deepEqual(task.labels, ["content"]);
	assert.equal(task.dueDate, "2026-11-02");
	const notes = (await gql(member, `query($s: String!) { workspace(slug: $s) { notifications { type text } } }`, { s: slug })).data
		?.workspace.notifications;
	assert.deepEqual(notes[0], { type: "assign", text: "assigned you" });
	assert.equal(code(await create(owner, { title: "x", labels: ["nope"] })), "BAD_USER_INPUT");
});

test("status changes record completion and the feed reads like the reference", async () => {
	const { owner, slug, project, create } = await setup();
	const id = (await create(owner, { title: "Ship it", status: "todo" })).data?.createTask.id;
	await gql(owner, UPDATE, { s: slug, id, p: { status: "in_progress" } });
	const done = (await gql(owner, UPDATE, { s: slug, id, p: { status: "completed" } })).data?.updateTask;
	assert.ok(done.completedAt, "completion is dated");
	const reopened = (await gql(owner, UPDATE, { s: slug, id, p: { status: "todo" } })).data?.updateTask;
	assert.equal(reopened.completedAt, null);
	const feed = (await gql(owner, `query($s: String!, $t: ID) { workspace(slug: $s) { activity(taskId: $t) { verb extra } } }`, { s: slug, t: id })).data
		?.workspace.activity;
	assert.deepEqual(
		feed.map((a: { verb: string; extra: string | null }) => [a.verb, a.extra]),
		[
			["reopened", null],
			["completed", null],
			["moved", "from To Do to In Progress"],
			["created", null],
		],
	);
	void project;
});

test("finishing a repeating task schedules the next one", async () => {
	const { owner, slug, project, create } = await setup();
	const id = (await create(owner, { title: "Weekly sync", recur: "Weekly", dueDate: "2026-11-02" })).data?.createTask.id;
	await gql(owner, UPDATE, { s: slug, id, p: { status: "completed" } });
	const tasks = (await gql(owner, TASKS, { s: slug, p: project.id })).data?.workspace.tasks;
	const next = tasks.filter((t: { title: string }) => t.title === "Weekly sync");
	assert.deepEqual(
		next.map((t: { status: string; dueDate: string }) => [t.status, t.dueDate]),
		[
			["completed", "2026-11-02"],
			["todo", "2026-11-09"],
		],
	);
});

test("people who can only comment can't change tasks, and guests off the project can't see them", async () => {
	const { owner, member, slug, create } = await setup();
	const id = (await create(owner, { title: "Locked" })).data?.createTask.id;
	assert.equal(code(await gql(member, UPDATE, { s: slug, id, p: { title: "x" } })), "FORBIDDEN");
	const comment = await gql(member, `mutation($s: String!, $t: ID!) { addComment(slug: $s, taskId: $t, text: "Looks good") { id isMine } }`, { s: slug, t: id });
	assert.equal(comment.data?.addComment.isMine, true, "commenting is allowed");

	const guest = await makeUser("guest");
	await gql(owner, `mutation($s: String!, $e: [String!]!) { inviteMembers(slug: $s, emails: $e, role: "guest") { id } }`, { s: slug, e: [guest.email] });
	const { inviteCode } = (await gql(owner, `query($s: String!) { workspace(slug: $s) { inviteCode } }`, { s: slug })).data?.workspace;
	await join(guest, inviteCode);
	const seen = await gql(guest, `query($s: String!, $t: ID!) { workspace(slug: $s) { task(id: $t) { id } tasks { id } } }`, { s: slug, t: id });
	assert.equal(seen.data?.workspace.task, null);
	assert.deepEqual(seen.data?.workspace.tasks, []);

	// mentions and assigning can't leak the task to someone off the project
	await gql(owner, `mutation($s: String!, $t: ID!) { addComment(slug: $s, taskId: $t, text: "@guest the price is 42") { id } }`, { s: slug, t: id });
	const inbox = await gql(guest, `query($s: String!) { workspace(slug: $s) { notifications { type } } }`, { s: slug });
	assert.deepEqual(inbox.data?.workspace.notifications, []);
	const guestId = (await gql(owner, `query($s: String!) { workspace(slug: $s) { members { id name } } }`, { s: slug })).data?.workspace.members.find(
		(m: { name: string }) => m.name === "guest",
	).id;
	assert.equal(code(await gql(owner, UPDATE, { s: slug, id, p: { assigneeId: guestId } })), "BAD_USER_INPUT");
});

test("subtasks, dependencies, mentions and reactions", async () => {
	const { owner, member, slug, project, create } = await setup();
	const parent = (await create(owner, { title: "Parent" })).data?.createTask;
	const blocker = (await create(owner, { title: "Blocker" })).data?.createTask;
	const sub = (await create(owner, { title: "Child", parentId: parent.id })).data?.createTask;
	await gql(owner, UPDATE, { s: slug, id: sub.id, p: { status: "completed" } });
	await gql(owner, `mutation($s: String!, $id: ID!, $d: [ID!]!) { setDependencies(slug: $s, id: $id, dependsOn: $d) { id } }`, {
		s: slug,
		id: parent.id,
		d: [blocker.id],
	});
	const tasks = (await gql(owner, TASKS, { s: slug, p: project.id })).data?.workspace.tasks;
	const p = tasks.find((t: { id: string }) => t.id === parent.id);
	assert.equal(p.subtaskCount, 1);
	assert.equal(p.subtaskDone, 1);
	assert.deepEqual(p.dependsOn, [blocker.id]);
	assert.ok(!tasks.some((t: { id: string }) => t.id === sub.id), "subtasks stay out of the task lists");

	const memberName = (await gql(member, "{ me { name } }")).data?.me.name;
	const c = await gql(owner, `mutation($s: String!, $t: ID!, $x: String!) { addComment(slug: $s, taskId: $t, text: $x) { id } }`, {
		s: slug,
		t: parent.id,
		x: `@${memberName} can you check?`,
	});
	const notes = (await gql(member, `query($s: String!) { workspace(slug: $s) { notifications { type snippet } } }`, { s: slug })).data
		?.workspace.notifications;
	assert.equal(notes[0].type, "mention");
	const REACT = `mutation($s: String!, $id: ID!) { reactToComment(slug: $s, id: $id, emoji: "👍") { reactions { emoji count mine } } }`;
	assert.deepEqual((await gql(member, REACT, { s: slug, id: c.data?.addComment.id })).data?.reactToComment.reactions, [
		{ emoji: "👍", count: 1, mine: true },
	]);
	assert.deepEqual((await gql(member, REACT, { s: slug, id: c.data?.addComment.id })).data?.reactToComment.reactions, [], "toggles off");
	assert.equal(
		code(await gql(member, `mutation($s: String!, $id: ID!) { deleteComment(slug: $s, id: $id) }`, { s: slug, id: c.data?.addComment.id })),
		"FORBIDDEN",
		"only your own comments",
	);
});
