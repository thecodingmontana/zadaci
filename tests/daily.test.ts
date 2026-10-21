import assert from "node:assert/strict";
import { after, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { localClock, runDaily } from "#/lib/daily.server";
import { authorized } from "#/routes/api/cron/daily";
import { cleanup, gql, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

test("each person's morning follows their own time zone", () => {
	const now = new Date("2026-10-21T05:30:00Z"); // a Wednesday
	assert.deepEqual(localClock("Africa/Nairobi", now), { day: "2026-10-21", hour: 8, weekend: false, monday: false });
	assert.equal(localClock("", now).hour, 5, "no time zone counts as UTC");
	assert.equal(localClock("Not/AZone", now).hour, 5, "a broken time zone counts as UTC");
	assert.equal(localClock("Pacific/Kiritimati", new Date("2026-10-23T12:00:00Z")).weekend, true);
});

test("the cron endpoint only answers to the secret", () => {
	assert.equal(authorized("Bearer s3cret", "s3cret"), true);
	assert.equal(authorized("Bearer wrong", "s3cret"), false);
	assert.equal(authorized(null, "s3cret"), false);
	assert.equal(authorized("Bearer ", ""), false, "no secret configured locks the endpoint");
});

test("tasks due tomorrow get one inbox reminder per morning, never twice", async () => {
	const owner = await makeUser("owner");
	await db.update(tables.user).set({ preferences: { tz: "Africa/Nairobi" } }).where(eq(tables.user.id, owner.id));
	const { slug } = await makeWorkspace(owner);
	const ws = (await gql(owner, `query($s: String!) { workspace(slug: $s) { members { id isMe } projects { id } } }`, { s: slug })).data
		?.workspace;
	const me = ws.members.find((m: { isMe: boolean }) => m.isMe).id;
	const create = (title: string, dueDate: string) =>
		gql(owner, `mutation($s: String!, $i: TaskInput!) { createTask(slug: $s, input: $i) { id } }`, {
			s: slug,
			i: { projectId: ws.projects[0].id, title, assigneeId: me, dueDate },
		});
	const dueTomorrow = (await create("Pricing copy", "2026-10-22")).data?.createTask.id;
	await create("Later", "2026-10-25");
	const reminders = () =>
		db
			.select({ task: tables.notification.task_id })
			.from(tables.notification)
			.where(and(eq(tables.notification.user_id, owner.id), eq(tables.notification.text, "is due tomorrow")));

	await runDaily(new Date("2026-10-21T04:30:00Z")); // 7:30 in Nairobi: too early
	assert.equal((await reminders()).length, 0);

	await runDaily(new Date("2026-10-21T05:30:00Z")); // 8:30
	assert.deepEqual(await reminders(), [{ task: dueTomorrow }]);

	await runDaily(new Date("2026-10-21T06:30:00Z")); // the next hourly run
	assert.equal((await reminders()).length, 1, "a later run the same day sends nothing again");
});
