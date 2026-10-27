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
