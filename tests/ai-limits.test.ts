import assert from "node:assert/strict";
import { after, test } from "node:test";
import { lastUserText, refundMessage, takeMessage } from "#/lib/ai/limits.server";
import { cleanup, makeUser } from "./helpers";

after(cleanup);

test("each person gets AI_DAILY_LIMIT messages a day, counted per day", async () => {
	process.env.AI_DAILY_LIMIT = "3";
	const amina = await makeUser("amina");
	const brian = await makeUser("brian");
	const sent = await Promise.all([1, 2, 3, 4].map(() => takeMessage(amina.id, "2026-10-23")));
	assert.equal(sent.filter(Boolean).length, 3, "the 4th message is refused, even when sent at once");
	assert.equal(await takeMessage(brian.id, "2026-10-23"), true, "someone else has their own count");
	assert.equal(await takeMessage(amina.id, "2026-10-24"), true, "a new day starts again");
	await refundMessage(amina.id, "2026-10-23");
	assert.equal(await takeMessage(amina.id, "2026-10-23"), true, "an unanswered message is given back");
	delete process.env.AI_DAILY_LIMIT;
});

test("the newest message's text is read from parts or plain content", () => {
	assert.equal(lastUserText([{ role: "user", parts: [{ type: "text", content: "hi" }] }]), "hi");
	assert.equal(lastUserText([{ role: "user", content: "plain" }]), "plain");
	assert.equal(lastUserText([{ role: "assistant", content: "x" }]), null);
});

test("only OpenRouter's real daily cap stops the assistant until midnight; busy models pause it briefly", async () => {
	const { ACCOUNT_ROW, recordFailure } = await import("#/lib/ai/rotation.server");
	const { db, tables } = await import("#/db");
	const { eq } = await import("drizzle-orm");
	const pause = async (message: string) => {
		await recordFailure("x/y:free", { kind: "account_limit", message });
		const [row] = await db.select().from(tables.ai_model).where(eq(tables.ai_model.id, ACCOUNT_ROW));
		return (row?.cooldown_until?.getTime() ?? 0) - Date.now();
	};
	try {
		assert.ok((await pause("Rate limited on two models in a row")) <= 5 * 60_000);
		const ms = await pause("Rate limit exceeded: free-models-per-day");
		assert.ok(ms > 5 * 60_000 && ms <= 24 * 3_600_000, "until the next midnight UTC");
	} finally {
		await db.delete(tables.ai_model).where(eq(tables.ai_model.id, ACCOUNT_ROW));
	}
});
