import assert from "node:assert/strict";
import { test } from "node:test";
import { parse } from "graphql";
import { mutationSlugs } from "./realtime.server";

test("a change is announced to the workspaces its mutation names, and reads announce nothing", () => {
	const slugs = (query: string, variables?: Record<string, unknown>) =>
		mutationSlugs(parse(query), variables).sort();

	assert.deepEqual(slugs(`mutation { archiveTask(slug: "acme", id: "1") }`), [
		"acme",
	]);
	assert.deepEqual(
		slugs(`mutation($s: String!) { archiveTask(slug: $s, id: "1") }`, {
			s: "beta",
		}),
		["beta"],
	);
	assert.deepEqual(
		slugs(
			`mutation($s: String!) { a: archiveTask(slug: $s, id: "1") b: archiveTask(slug: "acme", id: "2") }`,
			{ s: "beta" },
		),
		["acme", "beta"],
	);
	assert.deepEqual(slugs(`query { workspace(slug: "acme") { id } }`), []);
	assert.deepEqual(
		slugs(`mutation { setAiModel(provider: "x", model: "y") }`),
		[],
	);
});

test("changes nobody else sees (favourites, starting a timer, signing an upload) don't reload anyone's page", () => {
	const slugs = (q: string) => mutationSlugs(parse(q), {});
	assert.deepEqual(
		slugs(`mutation { toggleTaskFavorite(slug: "acme", id: "t") }`),
		[],
	);
	assert.deepEqual(
		slugs(`mutation { startTimer(slug: "acme", taskId: "t") { id } }`),
		[],
	);
	assert.deepEqual(
		slugs(
			`mutation { attachmentUpload(slug: "acme", taskId: "t", filename: "a.png") { url } }`,
		),
		[],
	);
	// stopping a timer logs time others can see
	assert.deepEqual(slugs(`mutation { stopTimer(slug: "acme") { id } }`), [
		"acme",
	]);
});
