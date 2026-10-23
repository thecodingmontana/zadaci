import assert from "node:assert/strict";
import { after, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { cleanup, gql, join, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

test("a task can have several assignees; each is told once and finds it in their own tasks", async () => {
	const owner = await makeUser("owner");
	const amina = await makeUser("amina");
	const brian = await makeUser("brian");
	const { slug, inviteCode } = await makeWorkspace(owner);
	await join(amina, inviteCode);
	await join(brian, inviteCode);
	const ws = (await gql(owner, `query($s: String!) { workspace(slug: $s) { members { id name } projects { id } } }`, { s: slug })).data?.workspace;
	const id = (name: string) => ws.members.find((m: { name: string }) => m.name === name).id;

	const created = await gql(owner, `mutation($s: String!, $i: TaskInput!) { createTask(slug: $s, input: $i) { id assigneeId assigneeIds } }`, {
		s: slug,
		i: { projectId: ws.projects[0].id, title: "Launch post", assigneeIds: [id("amina"), id("brian"), id("amina")] },
	});
	const task = created.data?.createTask;
	assert.ok(task, JSON.stringify(created.errors));
	assert.deepEqual([...task.assigneeIds].sort(), [id("amina"), id("brian")].sort(), "duplicates collapse");

	const told = async (userId: string) =>
		(await db.select().from(tables.notification).where(and(eq(tables.notification.user_id, userId), eq(tables.notification.task_id, task.id)))).length;
	assert.equal(await told(amina.id), 1);
	assert.equal(await told(brian.id), 1);

	const mine = (await gql(brian, `query($s: String!, $a: ID) { workspace(slug: $s) { tasks(assigneeId: $a) { id } } }`, { s: slug, a: id("brian") })).data?.workspace.tasks;
	assert.ok(mine.some((t: { id: string }) => t.id === task.id), "the second assignee sees it in My Tasks");

	const UPDATE = `mutation($s: String!, $id: ID!, $p: TaskPatch!) { updateTask(slug: $s, id: $id, patch: $p) { assigneeIds } }`;
	assert.deepEqual((await gql(owner, UPDATE, { s: slug, id: task.id, p: { assigneeIds: [id("brian")] } })).data?.updateTask.assigneeIds, [id("brian")]);
	assert.equal(await told(brian.id), 1, "staying assigned doesn't notify again");
	assert.deepEqual((await gql(owner, UPDATE, { s: slug, id: task.id, p: { assigneeIds: [] } })).data?.updateTask.assigneeIds, []);
	assert.ok((await gql(owner, UPDATE, { s: slug, id: task.id, p: { assigneeIds: ["nobody00000000"] } })).errors, "only workspace members");
});
