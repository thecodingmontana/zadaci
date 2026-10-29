import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { cleanup, gql, makeUser } from "./helpers";

after(cleanup);

const ONBOARD = `mutation($i: OnboardingInput!) { completeOnboarding(input: $i) { slug } }`;
const input = (useCases: string[]) => ({
	useCases,
	name: "Test",
	slug: `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
	defaultView: "board",
	teamSize: "2-10",
	projectName: "Alpha",
	templateId: "web",
	invites: [],
});

test("setup keeps every use case picked, once each, and needs at least one", async () => {
	const owner = await makeUser("owner");

	const none = await gql(owner, ONBOARD, { i: input([]) });
	assert.ok(none.errors?.length, "no use case is refused");

	const res = await gql(owner, ONBOARD, {
		i: input(["design", "engineering", "design"]),
	});
	assert.ok(res.data, JSON.stringify(res.errors));
	const [ws] = await db
		.select({ useCase: tables.workspace.use_case })
		.from(tables.workspace)
		.where(eq(tables.workspace.slug, res.data.completeOnboarding.slug));
	assert.equal(ws.useCase, "design,engineering");
});
