import assert from "node:assert/strict";
import { test } from "node:test";
import { GraphQLError } from "graphql";
import { isUnexpected } from "#/graphql/yoga.server";
import { errorText } from "#/lib/ai/gql.server";

test("only real bugs are logged, not refusals the resolvers throw on purpose", () => {
	const wrap = (original: Error) => new GraphQLError(original.message, { originalError: original });
	assert.equal(isUnexpected(wrap(new TypeError("cannot read x of undefined"))), true, "a crash is logged");
	assert.equal(isUnexpected(wrap(new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } }))), false);
	assert.equal(isUnexpected(new GraphQLError("Cannot query field")), false, "invalid queries aren't bugs");
});

test("errors from the assistant, agents and GitHub: refusals as written, crashes plain (and logged)", () => {
	const wrap = (original: Error) => new GraphQLError(original.message, { originalError: original });
	const crash = wrap(new Error('duplicate key value violates unique constraint "app_task_unique"'));
	const refusal = wrap(new GraphQLError("You can't edit this task", { extensions: { code: "FORBIDDEN" } }));
	const text = errorText([refusal, crash]);
	assert.match(text, /You can't edit this task/);
	assert.doesNotMatch(text, /app_task_unique|duplicate key/, "no database details reach an agent");
	assert.match(text, /Something went wrong/);
});
