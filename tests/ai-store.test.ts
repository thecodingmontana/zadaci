import assert from "node:assert/strict";
import { after, test } from "node:test";
import type { ModelMessage } from "@tanstack/ai";
import { eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { chatStore } from "#/lib/ai/store.server";
import { cleanup, gql, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

test("saved chats come back for their owner only, with the model that answered", async () => {
	const amina = await makeUser("amina");
	const brian = await makeUser("brian");
	const { slug } = await makeWorkspace(amina);
	const [ws] = await db.select({ id: tables.workspace.id }).from(tables.workspace).where(eq(tables.workspace.slug, slug));
	const thread = `t${Date.now()}`;
	const mine = chatStore({ userId: amina.id, workspaceId: ws.id, model: () => "test/model:free" });
	const messages: ModelMessage[] = [
		{ role: "user", content: "What's due this week?" },
		{ role: "assistant", content: "Two tasks." },
	];
	await mine.saveThread(thread, messages);
	assert.deepEqual((await mine.loadThread(thread)).map((m) => [m.role, m.content]), [
		["user", "What's due this week?"],
		["assistant", "Two tasks."],
	]);
	const [row] = await db.select({ model: tables.ai_message.model }).from(tables.ai_message).where(eq(tables.ai_message.role, "assistant"));
	assert.ok(row?.model, "the answering model is stored");

	const theirs = chatStore({ userId: brian.id, workspaceId: ws.id, model: () => null });
	assert.deepEqual(await theirs.loadThread(thread), [], "someone else's chat reads as empty");
	await theirs.saveThread(thread, [{ role: "user", content: "overwrite!" }]);
	assert.equal((await mine.loadThread(thread)).length, 2, "and can't be overwritten");

	const list = (await gql(amina, `query($s: String!) { aiConversations(slug: $s) { id title } }`, { s: slug })).data?.aiConversations;
	assert.deepEqual(list, [{ id: thread, title: "What's due this week?" }]);
	await gql(amina, `mutation($s: String!, $id: ID!) { deleteAiConversation(slug: $s, id: $id) }`, { s: slug, id: thread });
	assert.deepEqual(await mine.loadThread(thread), [], "deleting removes it");
});
