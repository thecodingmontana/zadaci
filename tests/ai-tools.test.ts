import assert from "node:assert/strict";
import { after, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { db, tables } from "#/db";
import type { AiContext } from "#/lib/ai/gql.server";
import { getItem, listTasks, searchItems } from "#/lib/ai/tools.server";
import { bulkUpdateTasks, createTask, deleteTasks, moveTask, updateTask } from "#/lib/ai/write-tools.server";
import { cleanup, gql, makeUser, makeWorkspace, type TestUser } from "./helpers";

after(cleanup);

// The assistant's tools, run the way chat() runs them: execute(input, { context }).
type Run = (input: unknown, opts: { context: AiContext; emitCustomEvent: () => void }) => unknown;
const call = async (tool: { execute?: unknown }, input: Record<string, unknown>, context: AiContext) =>
	// biome-ignore lint/suspicious/noExplicitAny: test results are checked field by field
	(await (tool.execute as Run)(input, { context, emitCustomEvent: () => {} })) as any;

async function person(label: string) {
	const user = await makeUser(label);
	const { slug } = await makeWorkspace(user);
	const ws = (
		await gql(user, `query($s: String!) { workspace(slug: $s) { projects { id } tasks { id name } } }`, { s: slug })
	).data?.workspace;
	const ctx = (): AiContext => ({ user: { id: user.id, email: user.email, name: label }, slug, today: "2026-10-23", edited: new Set() });
	return { user, slug, ctx, projectId: ws.projects[0].id as string, tasks: ws.tasks as { id: string; name: string }[] };
}

const setDue = (user: TestUser, slug: string, id: string, dueDate: string) =>
	gql(user, `mutation($s: String!, $id: ID!, $p: TaskPatch!) { updateTask(slug: $s, id: $id, patch: $p) { id } }`, { s: slug, id, p: { dueDate } });

test("listTasks answers 'what's overdue' and 'due today' from the person's own tasks", async () => {
	const a = await person("amina");
	await setDue(a.user, a.slug, a.tasks[0].id, "2026-10-20");
	await setDue(a.user, a.slug, a.tasks[1].id, "2026-10-23");
	const overdue = await call(listTasks, { due: "overdue" }, a.ctx());
	assert.deepEqual(overdue.tasks.map((t: { id: string }) => t.id), [a.tasks[0].id]);
	const today = await call(listTasks, { due: "today" }, a.ctx());
	assert.deepEqual(today.tasks.map((t: { id: string }) => t.id), [a.tasks[1].id]);
	assert.match((await call(listTasks, { tag: "Nope" }, a.ctx())).error, /Unknown tag/);
});

test("another person's ids and workspace give nothing back", async () => {
	const a = await person("amina");
	const b = await person("brian");
	assert.ok((await call(getItem, { kind: "task", id: b.tasks[0].id }, a.ctx())).error);
	assert.ok((await call(searchItems, { query: b.tasks[0].name }, { ...a.ctx(), slug: b.slug })).error);
	assert.ok((await call(updateTask, { taskIds: [b.tasks[0].id], priority: "urgent" }, a.ctx())).failed);
	assert.ok((await call(moveTask, { taskId: a.tasks[0].id, projectId: b.projectId }, a.ctx())).failed);
	assert.ok((await call(deleteTasks, { taskIds: [b.tasks[0].id] }, a.ctx())).error);
	const [theirs] = await db.select().from(tables.task).where(eq(tables.task.id, b.tasks[0].id));
	assert.ok(theirs && !theirs.deleted_at && theirs.priority !== "urgent", "their task is untouched");
});

test("more than 3 changes in one message need approval, even split across calls", async () => {
	const a = await person("amina");
	const ctx = a.ctx();
	const ids = a.tasks.map((t) => t.id);
	assert.equal((await call(updateTask, { taskIds: ids.slice(0, 2), priority: "high" }, ctx)).changed.length, 2);
	assert.equal((await call(updateTask, { taskIds: [ids[2]], priority: "high" }, ctx)).changed.length, 1);
	assert.match((await call(updateTask, { taskIds: [ids[3]], priority: "high" }, ctx)).error, /approval/);
	assert.equal(bulkUpdateTasks.needsApproval, true);
	assert.equal(deleteTasks.needsApproval, true);
	// once approved, the bulk tool changes them all
	assert.equal((await call(bulkUpdateTasks, { taskIds: ids, priority: "low" }, ctx)).changed.length, ids.length);
});

test("tasks the assistant creates go to the person and are logged as via assistant", async () => {
	const a = await person("amina");
	const res = await call(createTask, { title: "Call the printer", projectId: a.projectId, dueDate: "2026-10-24", tags: ["Design"] }, a.ctx());
	assert.ok(res.created?.id, JSON.stringify(res));
	const [mine] = await db.select().from(tables.task_assignees).where(eq(tables.task_assignees.task_id, res.created.id));
	assert.ok(mine, "assigned to the person by default");
	const [row] = await db
		.select({ via: tables.activity.via })
		.from(tables.activity)
		.where(and(eq(tables.activity.task_id, res.created.id), eq(tables.activity.verb, "created")));
	assert.equal(row?.via, "assistant");
	assert.match((await call(createTask, { title: "x", projectId: a.projectId, tags: ["Nope"] }, a.ctx())).error, /Unknown tag/);
});

test("the extra tools reach people, projects and notes, within the person's own permissions", async () => {
	const { archiveProject, assignTasks, createProject, editNote, listMembers, updateProject } = await import(
		"#/lib/ai/more-tools.server"
	);
	const { createNote } = await import("#/lib/ai/write-tools.server");
	const a = await person("amina");
	const b = await person("brian");
	const me = (await call(listMembers, {}, a.ctx())).members.find((m: { isMe: boolean }) => m.isMe);
	assert.equal((await call(assignTasks, { taskIds: [a.tasks[0].id], memberIds: [me.id] }, a.ctx())).changed.length, 1);
	const [row] = await db.select().from(tables.task_assignees).where(eq(tables.task_assignees.task_id, a.tasks[0].id));
	assert.equal(row?.member_id, me.id);

	const made = (await call(createProject, { title: "Launch" }, a.ctx())).projects[0];
	assert.ok(made.id);
	await call(updateProject, { projectId: made.id, status: "risk" }, a.ctx());
	const [proj] = await db.select().from(tables.project).where(eq(tables.project.id, made.id));
	assert.equal(proj?.status, "risk");
	assert.ok((await call(updateProject, { projectId: b.projectId, status: "risk" }, a.ctx())).error, "not someone else's");
	assert.equal(archiveProject.needsApproval, true);

	const note = (await call(createNote, { title: "Plan", text: "First" }, a.ctx())).created;
	await call(editNote, { noteId: note.id, appendText: "- Second" }, a.ctx());
	const [n] = await db.select().from(tables.note).where(eq(tables.note.id, note.id));
	assert.match(JSON.stringify(n?.doc), /First.*Second/);
});
