import assert from "node:assert/strict";
import { after, test } from "node:test";
import { lastUserText, takeMessage } from "#/lib/ai/limits.server";
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
	delete process.env.AI_DAILY_LIMIT;
});

test("the newest message's text is read from parts or plain content", () => {
	assert.equal(lastUserText([{ role: "user", parts: [{ type: "text", content: "hi" }] }]), "hi");
	assert.equal(lastUserText([{ role: "user", content: "plain" }]), "plain");
	assert.equal(lastUserText([{ role: "assistant", content: "x" }]), null);
});
