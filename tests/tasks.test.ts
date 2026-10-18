import assert from "node:assert/strict";
import { after, test } from "node:test";
import { and, eq, isNull } from "drizzle-orm";
import { db, tables } from "#/db";
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

test("simultaneous clicks don't double up: one repeat, one assignee, one star", async () => {
	const { owner, slug, project, memberId, create } = await setup();
	const id = (await create(owner, { title: "Daily standup", recur: "Daily", dueDate: "2026-11-02" })).data?.createTask.id;
	await Promise.all([1, 2, 3].map(() => gql(owner, UPDATE, { s: slug, id, p: { status: "completed" } })));
	const tasks = (await gql(owner, TASKS, { s: slug, p: project.id })).data?.workspace.tasks;
	assert.equal(tasks.filter((t: { title: string }) => t.title === "Daily standup").length, 2, "the done one and a single next copy");

	const ownerId = (await gql(owner, `query($s: String!) { workspace(slug: $s) { members { id isMe } } }`, { s: slug })).data?.workspace.members.find(
		(m: { isMe: boolean }) => m.isMe,
	).id;
	await Promise.all([memberId, ownerId, memberId].map((a) => gql(owner, UPDATE, { s: slug, id, p: { assigneeId: a } })));
	const live = await db
		.select({ id: tables.task_assignees.id })
		.from(tables.task_assignees)
		.where(and(eq(tables.task_assignees.task_id, id), isNull(tables.task_assignees.deleted_at)));
	assert.equal(live.length, 1);

	const STAR = `mutation($s: String!, $id: ID!) { toggleTaskFavorite(slug: $s, id: $id) }`;
	const stars = await Promise.all([1, 2].map(() => gql(owner, STAR, { s: slug, id })));
	assert.deepEqual(stars.map((r) => r.errors), [undefined, undefined], "a double click isn't an error");
});

test("moving and bulk-deleting take subtasks along, and one forbidden id stops the whole delete", async () => {
	const { owner, member, slug, project, create } = await setup();
	const other = (
		await gql(owner, `mutation($s: String!, $i: ProjectInput!) { createProject(slug: $s, input: $i) { id key } }`, {
			s: slug,
			i: { title: "Beta Launch", icon: "icon-[solar--global-linear]", color: "teal", template: "blank" },
		})
	).data?.createProject;
	const parent = (await create(owner, { title: "Move me" })).data?.createTask;
	const child = (await create(owner, { title: "Child", parentId: parent.id })).data?.createTask;
	await gql(owner, `mutation($s: String!, $id: ID!) { toggleTaskFavorite(slug: $s, id: $id) }`, { s: slug, id: child.id });

	const moved = (await gql(owner, UPDATE, { s: slug, id: parent.id, p: { projectId: other.id } })).data?.updateTask;
	assert.ok(moved.key.startsWith(`${other.key}-`), "renumbered in the new project");
	const [movedChild] = await db.select({ projectId: tables.task.project_id }).from(tables.task).where(eq(tables.task.id, child.id));
	assert.equal(movedChild?.projectId, other.id, "the subtask follows");

	// the member can only comment, so a delete including the owner's task changes nothing
	const mine = (await create(owner, { title: "Keep" })).data?.createTask;
	const DEL = `mutation($s: String!, $ids: [ID!]!) { deleteTasks(slug: $s, ids: $ids) }`;
	assert.equal(code(await gql(member, DEL, { s: slug, ids: [mine.id] })), "FORBIDDEN");
	assert.equal((await gql(owner, DEL, { s: slug, ids: [parent.id] })).data?.deleteTasks, 1);
	const [gone] = await db.select({ deletedAt: tables.task.deleted_at }).from(tables.task).where(eq(tables.task.id, child.id));
	assert.ok(gone?.deletedAt, "subtasks go with their parent");
	const stars = await db.select().from(tables.favorite).where(eq(tables.favorite.entity_id, child.id));
	assert.deepEqual(stars, [], "and so do stars on them");
	void project;
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

test("sidebar counts: my open tasks and everything archived", async () => {
	const { owner, slug, project, create } = await setup();
	const me = (await gql(owner, `query($s: String!) { workspace(slug: $s) { members { id isMe } } }`, { s: slug })).data?.workspace.members.find(
		(m: { isMe: boolean }) => m.isMe,
	).id;
	const a = (await create(owner, { title: "Mine", assigneeId: me })).data?.createTask;
	await create(owner, { title: "Mine too", assigneeId: me, status: "completed" });
	await gql(owner, `mutation($s: String!, $id: ID!) { archiveTask(slug: $s, id: $id, archived: true) { id } }`, { s: slug, id: a.id });
	const COUNTS = `query($s: String!) { workspace(slug: $s) { myOpenTasks archivedCount } }`;
	assert.deepEqual((await gql(owner, COUNTS, { s: slug })).data?.workspace, { myOpenTasks: 0, archivedCount: 1 });
	await gql(owner, `mutation($s: String!, $id: ID!) { archiveTask(slug: $s, id: $id, archived: false) { id } }`, { s: slug, id: a.id });
	assert.equal((await gql(owner, COUNTS, { s: slug })).data?.workspace.myOpenTasks, 1, "back in my open tasks");
	await gql(owner, `mutation($s: String!, $p: ID!) { archiveProject(slug: $s, projectId: $p, archived: true) { id } }`, { s: slug, p: project.id });
	assert.deepEqual((await gql(owner, COUNTS, { s: slug })).data?.workspace, { myOpenTasks: 0, archivedCount: 1 }, "an archived project counts once, its tasks don't");
});

test("bulk edits check the assignee first, so a bad one changes no task", async () => {
	const { owner, slug, create } = await setup();
	const ids: string[] = [];
	for (const title of ["One", "Two", "Three", "Four"]) ids.push((await create(owner, { title })).data?.createTask.id);
	const BULK = `mutation($s: String!, $ids: [ID!]!, $p: TaskPatch!) { bulkUpdateTasks(slug: $s, ids: $ids, patch: $p) }`;
	const bad = await gql(owner, BULK, { s: slug, ids, p: { status: "completed", assigneeId: "not-a-member" } });
	assert.equal(code(bad), "BAD_USER_INPUT");
	const after = (await gql(owner, TASKS, { s: slug })).data?.workspace.tasks.filter((t: { id: string }) => ids.includes(t.id));
	assert.ok(after.every((t: { status: string }) => t.status !== "completed"), "nothing changed");
	const ok = await gql(owner, BULK, { s: slug, ids, p: { priority: "high" } });
	assert.equal(ok.data?.bulkUpdateTasks, 4);
});

test("completing a repeating task again after reopening it makes no second copy", async () => {
	const { owner, slug, create } = await setup();
	const id = (await create(owner, { title: "Weekly review", recur: "Weekly", dueDate: "2026-11-02" })).data?.createTask.id;
	for (const status of ["completed", "todo", "completed"]) await gql(owner, UPDATE, { s: slug, id, p: { status } });
	const copies = (await gql(owner, TASKS, { s: slug })).data?.workspace.tasks.filter((t: { title: string }) => t.title === "Weekly review");
	assert.equal(copies.length, 2, "the original and one next copy");
});

test("two reactions at the same moment both count, and tasks can't wait on each other", async () => {
	const { owner, member, slug, create } = await setup();
	const a = (await create(owner, { title: "A" })).data?.createTask.id;
	const b = (await create(owner, { title: "B" })).data?.createTask.id;
	const comment = (await gql(owner, `mutation($s: String!, $t: ID!) { addComment(slug: $s, taskId: $t, text: "Ship it") { id } }`, { s: slug, t: a })).data?.addComment.id;
	const REACT = `mutation($s: String!, $id: ID!) { reactToComment(slug: $s, id: $id, emoji: "🎉") { id } }`;
	await Promise.all([gql(owner, REACT, { s: slug, id: comment }), gql(member, REACT, { s: slug, id: comment })]);
	const reactions = (await gql(owner, `query($s: String!, $t: ID!) { workspace(slug: $s) { task(id: $t) { comments { reactions { emoji count } } } } }`, { s: slug, t: a })).data?.workspace.task.comments[0].reactions;
	assert.deepEqual(reactions, [{ emoji: "🎉", count: 2 }]);

	const DEPS = `mutation($s: String!, $id: ID!, $d: [ID!]!) { setDependencies(slug: $s, id: $id, dependsOn: $d) { id } }`;
	await gql(owner, DEPS, { s: slug, id: a, d: [b] });
	assert.equal(code(await gql(owner, DEPS, { s: slug, id: b, d: [a] })), "BAD_USER_INPUT");
});

test("duplicating a project copies tasks in bulk and keeps subtasks under their copied parent", async () => {
	const { owner, slug, project, create } = await setup();
	const parent = (await create(owner, { title: "Launch" })).data?.createTask.id;
	await create(owner, { title: "Write post", parentId: parent });
	const copy = (await gql(owner, `mutation($s: String!, $p: ID!) { duplicateProject(slug: $s, projectId: $p) { id } }`, { s: slug, p: project.id })).data?.duplicateProject.id;
	const tasks = (await gql(owner, `query($s: String!, $p: ID) { workspace(slug: $s) { tasks(projectId: $p) { id name } } }`, { s: slug, p: copy })).data?.workspace.tasks;
	const launch = tasks.find((t: { name: string }) => t.name === "Launch");
	assert.ok(launch && launch.id !== parent, "the parent was copied");
	const subtasks = (await gql(owner, `query($s: String!, $t: ID!) { workspace(slug: $s) { task(id: $t) { subtasks { name } } } }`, { s: slug, t: launch.id })).data?.workspace.task.subtasks;
	assert.deepEqual(subtasks, [{ name: "Write post" }], "the subtask points at the copied parent");
});
