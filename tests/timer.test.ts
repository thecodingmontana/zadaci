import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { cleanup, gql, join, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

const TIME = `query($s: String!, $id: ID!) { workspace(slug: $s) { task(id: $id) { timeSpent myTimerStartedAt } } }`;
const START = `mutation($s: String!, $t: ID!) { startTimer(slug: $s, taskId: $t) }`;

test("one running timer per person; time adds up and a forgotten timer counts 12 hours at most", async () => {
	const owner = await makeUser("owner");
	const { slug, inviteCode } = await makeWorkspace(owner);
	const tasks = (await gql(owner, `query($s: String!) { workspace(slug: $s) { tasks { id } } }`, { s: slug })).data?.workspace.tasks;
	const [a, b] = tasks;

	assert.equal((await gql(owner, START, { s: slug, t: a.id })).data?.startTimer, true);
	assert.ok((await gql(owner, TIME, { s: slug, id: a.id })).data?.workspace.task.myTimerStartedAt, "running on A");
	await gql(owner, START, { s: slug, t: b.id });
	assert.equal((await gql(owner, TIME, { s: slug, id: a.id })).data?.workspace.task.myTimerStartedAt, null, "starting B stopped A");

	// pretend B's timer was left running for two days
	await db
		.update(tables.time_entry)
		.set({ started_at: new Date(Date.now() - 48 * 3600_000) })
		.where(eq(tables.time_entry.task_id, b.id));
	await gql(owner, `mutation($s: String!) { stopTimer(slug: $s) }`, { s: slug });
	const spent = (await gql(owner, TIME, { s: slug, id: b.id })).data?.workspace.task;
	assert.equal(spent.myTimerStartedAt, null);
	assert.equal(spent.timeSpent, 12 * 3600, "capped at 12 hours");

	const guest = await makeUser("viewer");
	await join(guest, inviteCode);
	assert.ok((await gql(await makeUser("outsider"), START, { s: slug, t: a.id })).errors, "outsiders can't log time");
});
