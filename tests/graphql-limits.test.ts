import assert from "node:assert/strict";
import { after, test } from "node:test";
import { costLimitRule } from "@escape.tech/graphql-armor-cost-limit";
import { maxAliasesRule } from "@escape.tech/graphql-armor-max-aliases";
import { maxDepthRule } from "@escape.tech/graphql-armor-max-depth";
import { type DocumentNode, validate } from "graphql";
import * as noteOps from "#/graphql/note-operations";
import * as ops from "#/graphql/operations";
import { LIMITS, schema } from "#/graphql/yoga.server";
import { cleanup, gql, makeUser, makeWorkspace } from "./helpers";

after(cleanup);

test("every operation the app sends fits the request limits", () => {
	const docs = Object.entries({ ...ops, ...noteOps }).filter(
		([, v]) => (v as DocumentNode)?.kind === "Document",
	);
	assert.ok(docs.length > 50);
	for (const [name, doc] of docs) {
		const errors = validate(schema, doc as DocumentNode, [
			maxAliasesRule({ n: LIMITS.aliases }),
			maxDepthRule({ n: LIMITS.depth }),
			costLimitRule({ maxCost: LIMITS.cost }),
		]);
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
