import assert from "node:assert/strict";
import { after, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { DUE_REMINDER, localClock, runDaily } from "#/lib/daily.server";
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

test("due tomorrow, due today and newly overdue tasks get one reminder at the chosen hour, never twice", async () => {
	const owner = await makeUser("owner");
	await db.update(tables.user).set({ preferences: { autoTz: "Africa/Nairobi", digestHour: "9" } }).where(eq(tables.user.id, owner.id));
	const { slug } = await makeWorkspace(owner);
	const ws = (await gql(owner, `query($s: String!) { workspace(slug: $s) { members { id isMe } projects { id } } }`, { s: slug })).data
		?.workspace;
	const me = ws.members.find((m: { isMe: boolean }) => m.isMe).id;
	const create = (title: string, dueDate: string) =>
		gql(owner, `mutation($s: String!, $i: TaskInput!) { createTask(slug: $s, input: $i) { id } }`, {
			s: slug,
			i: { projectId: ws.projects[0].id, title, assigneeId: me, dueDate },
		});
	const id = async (title: string, day: string) => (await create(title, day)).data?.createTask.id as string;
	const tomorrow = await id("Pricing copy", "2026-10-22");
	const today = await id("Standup notes", "2026-10-21");
	const lateYesterday = await id("Invoice", "2026-10-20");
	await id("Old report", "2026-10-18"); // overdue for days: already reminded, no nagging
	await id("Later", "2026-10-25");
	const reminders = async () =>
		(
			await db
				.select({ task: tables.notification.task_id, text: tables.notification.text })
				.from(tables.notification)
				.where(and(eq(tables.notification.user_id, owner.id), eq(tables.notification.type, "update")))
		)
			.filter((r) => r.text.startsWith("is "))
			.sort((a, b) => a.text.localeCompare(b.text));

	await runDaily(new Date("2026-10-21T05:30:00Z")); // 8:30 in Nairobi: before their 9:00
	assert.equal((await reminders()).length, 0);

	await runDaily(new Date("2026-10-21T06:30:00Z")); // 9:30
	assert.deepEqual(await reminders(), [
		{ task: today, text: "is due today" },
		{ task: tomorrow, text: "is due tomorrow" },
		{ task: lateYesterday, text: "is overdue" },
	]);

	await runDaily(new Date("2026-10-21T07:30:00Z")); // the next hourly run
	assert.equal((await reminders()).length, 3, "a later run the same day sends nothing again");
});

test("overdue alerts follow the 'When my task is overdue' setting", async () => {
	const owner = await makeUser("owner");
	await db.update(tables.user).set({ preferences: { notif: { assign_over: false } } }).where(eq(tables.user.id, owner.id));
	const { slug } = await makeWorkspace(owner);
	const ws = (await gql(owner, `query($s: String!) { workspace(slug: $s) { members { id isMe } projects { id } } }`, { s: slug })).data?.workspace;
	const me = ws.members.find((m: { isMe: boolean }) => m.isMe).id;
	const add = (title: string, dueDate: string) =>
		gql(owner, `mutation($s: String!, $i: TaskInput!) { createTask(slug: $s, input: $i) { id } }`, { s: slug, i: { projectId: ws.projects[0].id, title, assigneeId: me, dueDate } });
	await add("Late", "2026-11-03");
	await add("Today", "2026-11-04");
	await runDaily(new Date("2026-11-04T12:00:00Z"));
	const texts = (await db.select({ text: tables.notification.text }).from(tables.notification).where(eq(tables.notification.user_id, owner.id))).map((r) => r.text);
	assert.ok(texts.includes(DUE_REMINDER[0].text), "today's reminder still comes");
	assert.ok(!texts.includes(DUE_REMINDER[-1].text), "no overdue alert when it's turned off");
});

test("the saved browser zone must be a real time zone", async () => {
	const user = await makeUser("tz");
	const save = (patch: object) => gql(user, `mutation($p: JSON!) { updatePreferences(patch: $p) }`, { p: patch });
	assert.equal((await save({ autoTz: "Europe/Berlin", digestHour: "7" })).data?.updatePreferences.digestHour, "7");
	assert.ok((await save({ autoTz: "Mars/Olympus" })).errors, "unknown zones are refused");
	assert.ok((await save({ digestHour: "24" })).errors, "hours stop at 23");
});
