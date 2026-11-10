import assert from "node:assert/strict";
import { after, test } from "node:test";
import { type DocumentNode, parse, validate } from "graphql";
import { requestLimits } from "#/graphql/limits";
import * as bookmarkOps from "#/graphql/bookmark-operations";
import * as noteOps from "#/graphql/note-operations";
import * as ops from "#/graphql/operations";
import { LIMITS, schema } from "#/graphql/yoga.server";
import { cleanup, gql, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

test("every operation the app sends fits the request limits", () => {
	const docs = Object.entries({ ...ops, ...noteOps, ...bookmarkOps }).filter(
		([, v]) => (v as DocumentNode)?.kind === "Document",
	);
	assert.ok(docs.length > 50);
	for (const [name, doc] of docs) {
		const errors = validate(schema, doc as DocumentNode, [requestLimits(LIMITS)]);
		assert.deepEqual(errors.map((e) => e.message), [], `${name} is over the limits`);
	}
});

test("one request can't repeat a list hundreds of times", async () => {
	const owner = await makeUser("owner");
	const { slug } = await makeWorkspace(owner);
	const flood = Array.from({ length: 200 }, (_, i) => `a${i}: workspace(slug: $s) { tasks { id } }`).join("\n");
	const res = await gql(owner, `query($s: String!) { ${flood} }`, { s: slug });
	assert.equal(res.data, undefined);
	assert.ok(res.errors?.length);
});

test("too many aliases, levels or fields are refused before anything runs, fragments included", () => {
	const check = (query: string) =>
		validate(schema, parse(query), [requestLimits(LIMITS)]).map((e) => e.message).join(" ");
	const aliases = Array.from({ length: LIMITS.aliases + 1 }, (_, i) => `a${i}: me { id }`).join(" ");
	assert.match(check(`{ ${aliases} }`), /too many aliases/);
	// nesting hidden in a fragment still counts
	let deep = "id";
	for (let i = 0; i < LIMITS.depth + 1; i++) deep = `me { ${deep} }`;
	assert.match(check(`query { ...F } fragment F on Query { ${deep} }`), /too many levels/);
	assert.equal(check(`{ me { id } }`), "", "an ordinary request passes");
});
