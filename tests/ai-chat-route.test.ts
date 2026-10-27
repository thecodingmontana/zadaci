import assert from "node:assert/strict";
import { after, test } from "node:test";
import { db, tables } from "#/db";
import { userClock } from "#/lib/ai/limits.server";
import { Route } from "#/routes/api/chat";
import { cleanup, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

// the route only needs a shared key to exist; these requests are refused before any model call
process.env.OPENROUTER_API_KEY ||= "sk-or-test";

type Post = (ctx: { request: Request }) => Promise<Response>;
const post = (Route.options.server?.handlers as unknown as { POST: Post }).POST;

const ask = (cookie: string, slug: string, messages: unknown[], extra: Record<string, unknown> = {}) =>
	post({
		request: new Request("http://test/api/chat", {
			method: "POST",
			headers: { cookie, "content-type": "application/json" },
			body: JSON.stringify({ threadId: "t", runId: "r", messages, tools: [], context: [], forwardedProps: { slug }, ...extra }),
		}),
	}).then((r) => r.text());

test("the free daily limit and size cap can't be dodged by how the chat is sent", async () => {
	const amina = await makeUser("amina");
	const { slug } = await makeWorkspace(amina);
	// today's free messages are already used up
	const { today } = await userClock(amina.id);
	await db.insert(tables.ai_usage).values({ user_id: amina.id, day: today, count: 99 });

	const endsWithAnswer = [
		{ id: "1", role: "user", content: "Plan my week" },
		{ id: "2", role: "assistant", content: "Sure" },
	];
	assert.match(await ask(amina.cookie, slug, endsWithAnswer), /daily_limit/, "a chat ending in an answer still counts");
	const claimsResume = { resume: [{ interruptId: "fake", status: "resolved", payload: { approved: true } }] };
	assert.match(
		await ask(amina.cookie, slug, [...endsWithAnswer, { id: "3", role: "user", content: "One more" }], claimsResume),
		/daily_limit/,
		"saying it's an approval answer doesn't make a message free",
	);

	const huge = [
		{ id: "1", role: "user", content: "x".repeat(150_000) },
		{ id: "2", role: "assistant", content: "x".repeat(150_000) },
		{ id: "3", role: "user", content: "hi" },
	];
	assert.match(await ask(amina.cookie, slug, huge), /too_long/, "the whole history is size-checked");
});
