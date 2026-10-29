import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import { eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { notify } from "#/graphql/activity.server";
import { withEmails } from "#/lib/email.server";
import { cleanup, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

test("a notification's email goes out at the end, and only if its change was saved", async () => {
	const owner = await makeUser("owner");
	const pat = await makeUser("pat");
	const { slug } = await makeWorkspace(owner);
	const [ws] = await db.select({ id: tables.workspace.id }).from(tables.workspace).where(eq(tables.workspace.slug, slug));
	const row = (text: string) => ({ user_id: pat.id, actor_id: owner.id, workspace_id: ws?.id ?? "", type: "assign", text });
	// with no email key set, each send logs a line instead
	const log = mock.method(console, "info", () => {});
	const sent = (text: string) => log.mock.calls.some((c) => String(c.arguments[0]).includes(text));
	try {
		await withEmails(async () => {
			await db
				.transaction(async (tx) => {
					await notify(tx, [row("rolled back")]);
					throw new Error("the change failed");
				})
				.catch(() => {});
			await db.transaction((tx) => notify(tx, [row("kept")]));
			assert.equal(sent("kept"), false, "nothing goes out before the work is done");
		});
		assert.equal(sent("kept"), true, "the saved one is emailed");
		assert.equal(sent("rolled back"), false, "the rolled-back one isn't");
	} finally {
		log.mock.restore();
	}
});
