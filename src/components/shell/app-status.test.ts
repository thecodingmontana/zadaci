import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILD } from "#/lib/build";
import { newerBuild } from "./app-status";

const answering = (body: unknown, ok = true) =>
	(async () =>
		new Response(JSON.stringify(body), {
			status: ok ? 200 : 500,
		})) as unknown as typeof fetch;

test("a page offers a reload only when the server runs a different build", async () => {
	assert.equal(
		await newerBuild(answering({ build: BUILD })),
		false,
		"same build: nothing to do",
	);
	assert.equal(
		await newerBuild(answering({ build: `${BUILD}-next` })),
		true,
		"deployed since: reload",
	);
	assert.equal(
		await newerBuild(answering({}, false)),
		null,
		"server error: can't tell",
	);
	const offline = (async () => {
		throw new TypeError("Failed to fetch");
	}) as unknown as typeof fetch;
	assert.equal(await newerBuild(offline), null, "offline: can't tell");
});
