import assert from "node:assert/strict";
import { test } from "node:test";
import { GraphQLError } from "graphql";
import { isUnexpected } from "#/graphql/yoga.server";

test("only real bugs are logged, not refusals the resolvers throw on purpose", () => {
	const wrap = (original: Error) => new GraphQLError(original.message, { originalError: original });
	assert.equal(isUnexpected(wrap(new TypeError("cannot read x of undefined"))), true, "a crash is logged");
	assert.equal(isUnexpected(wrap(new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } }))), false);
	assert.equal(isUnexpected(new GraphQLError("Cannot query field")), false, "invalid queries aren't bugs");
});
