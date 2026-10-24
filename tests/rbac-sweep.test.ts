import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
	type GraphQLArgument,
	type GraphQLField,
	type GraphQLInputType,
	getNamedType,
	isEnumType,
	isInputObjectType,
	isLeafType,
	isListType,
	isNonNullType,
	isObjectType,
} from "graphql";
import { schema } from "#/graphql/yoga.server";
import { cleanup, gql, makeUser, makeWorkspace } from "./helpers";

// Calls every query and mutation in the schema, with made-up arguments, as someone signed
// out and as a signed-in outsider. A new field that forgets its permission check fails here.

after(cleanup);

/** Fields any signed-in person may use without belonging to the workspace. */
const ACCOUNT_LEVEL = new Set([
	"me",
	"workspaces",
	"slugAvailable",
	"unsplash",
	"unsplashEnabled",
	"unsplashPicked",
	"updatePreferences",
	"pushPublicKey",
	"subscribePush",
	"unsubscribePush",
	"testPush",
	"expandMapLink",
	// your own AI keys and free allowance: personal, not workspace data
	"aiStatus",
	"setAiKey",
	"useAiKey",
	"setAiModel",
	"removeAiKey",
]);

function value(type: GraphQLInputType, slug: string, name: string): unknown {
	if (isNonNullType(type)) return value(type.ofType, slug, name);
	if (isListType(type)) return [];
	if (isEnumType(type)) return type.getValues()[0]?.value;
	if (isInputObjectType(type))
		return Object.fromEntries(
			Object.values(type.getFields())
				.filter((f) => isNonNullType(f.type))
				.map((f) => [f.name, value(f.type, slug, f.name)]),
		);
	switch (getNamedType(type).name) {
		case "Int":
		case "Float":
			return 1;
		case "Boolean":
			return true;
		case "JSON":
			return {};
		default:
			return name === "slug" ? slug : "x0000000000000000";
	}
}

function call(kind: "query" | "mutation", field: GraphQLField<unknown, unknown>, slug: string) {
	const args = field.args as readonly GraphQLArgument[];
	const vars = args.map((a) => `$${a.name}: ${a.type}`).join(", ");
	const pass = args.map((a) => `${a.name}: $${a.name}`).join(", ");
	const select = isLeafType(getNamedType(field.type)) ? "" : "{ __typename }";
	return {
		doc: `${kind}${vars ? `(${vars})` : ""} { ${field.name}${pass ? `(${pass})` : ""} ${select} }`,
		variables: Object.fromEntries(args.map((a) => [a.name, value(a.type, slug, a.name)])),
	};
}

const fields = () =>
	(["query", "mutation"] as const).flatMap((kind) => {
		const root = kind === "query" ? schema.getQueryType() : schema.getMutationType();
		return isObjectType(root) ? Object.values(root.getFields()).map((f) => ({ kind, f })) : [];
	});

test("signed out, nothing answers", async () => {
	const owner = await makeUser("owner");
	const { slug } = await makeWorkspace(owner);
	const open = [];
	for (const { kind, f } of fields()) {
		const { doc, variables } = call(kind, f, slug);
		const res = await gql(null, doc, variables);
		if (res.data?.[f.name] != null) open.push(`${kind} ${f.name}`);
	}
	assert.deepEqual(open, [], "these answered someone signed out");
});

test("an outsider gets nothing from someone else's workspace", async () => {
	const owner = await makeUser("owner");
	const { slug } = await makeWorkspace(owner);
	const outsider = await makeUser("outsider");
	const open = [];
	for (const { kind, f } of fields()) {
		if (ACCOUNT_LEVEL.has(f.name)) continue;
		const { doc, variables } = call(kind, f, slug);
		const res = await gql(outsider, doc, variables);
		const data = res.data?.[f.name];
		if (data != null && !(Array.isArray(data) && !data.length)) open.push(`${kind} ${f.name}`);
	}
	assert.deepEqual(open, [], "these answered an outsider");
});
