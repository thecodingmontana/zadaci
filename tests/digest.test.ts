import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import { and, eq, like } from "drizzle-orm";
import { db, tables } from "#/db";
import { cleanup, gql, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

// The digest email, when the email service refuses it: it's logged for /admin, not counted as sent.
// The key is set before the email module loads (it reads it once); Resend is faked: nothing leaves.
process.env.RESEND_API_KEY = "re_test_refused";
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
	String(input).startsWith("https://api.resend.com")
		? Response.json({ name: "rate_limit_exceeded", message: "Too many requests" }, { status: 429 })
		: realFetch(input, init)) as typeof fetch;
after(() => {
	globalThis.fetch = realFetch;
	process.env.RESEND_API_KEY = "";
});

test("a digest the email service refuses goes to the error log and isn't counted as sent", async () => {
	const { runDaily } = await import("#/lib/daily.server");
	const owner = await makeUser("digest-refused");
	await db.update(tables.user).set({ preferences: { autoTz: "UTC", digestHour: "9" } }).where(eq(tables.user.id, owner.id));
	const { slug } = await makeWorkspace(owner);
	const ws = (await gql(owner, `query($s: String!) { workspace(slug: $s) { members { id isMe } projects { id } } }`, { s: slug })).data?.workspace;
	const me = ws.members.find((m: { isMe: boolean }) => m.isMe).id;
	await gql(owner, `mutation($s: String!, $i: TaskInput!) { createTask(slug: $s, input: $i) { id } }`, {
		s: slug,
		i: { projectId: ws.projects[0].id, title: "Ship it", assigneeId: me, dueDate: "2026-12-09" },
	});

	// an unread notification from just before the run, for the digest to summarise
	const [workspace] = await db.select({ id: tables.workspace.id }).from(tables.workspace).where(eq(tables.workspace.slug, slug));
	await db.insert(tables.notification).values({
		user_id: owner.id,
		workspace_id: workspace.id,
		type: "update",
		text: "commented on your task",
		created_at: new Date("2026-12-09T08:00:00Z"),
	});

	const quiet = mock.method(console, "error", () => {});
	let result: Awaited<ReturnType<typeof runDaily>>;
	try {
		result = await runDaily(new Date("2026-12-09T09:30:00Z")); // a Wednesday
	} finally {
		quiet.mock.restore();
	}
	assert.equal(result.digests, 0, "not counted as sent");
	const logged = await db
		.select()
		.from(tables.error_log)
		.where(and(eq(tables.error_log.source, "cron"), like(tables.error_log.message, "digest failed%")));
	assert.ok(logged.length >= 1, "kept for the admin page");
});
