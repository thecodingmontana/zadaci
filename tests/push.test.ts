import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { cleanup, gql, makeUser } from "./helpers";

after(cleanup);

const SUB = `mutation($e: String!, $p: String!, $a: String!) { subscribePush(endpoint: $e, p256dh: $p, auth: $a) }`;
const UNSUB = `mutation($e: String!) { unsubscribePush(endpoint: $e) }`;

test("each device's push subscription belongs to whoever signed in on it last", async () => {
	const ann = await makeUser("ann");
	const bob = await makeUser("bob");
	const endpoint = `https://push.example.com/send/${Date.now()}`;
	const owner = async () =>
		(await db.select().from(tables.push_subscription).where(eq(tables.push_subscription.endpoint, endpoint)))[0]?.user_id;

	assert.equal(
		(await gql(ann, SUB, { e: "http://insecure.example.com/x", p: "k", a: "a" })).errors?.[0]?.extensions?.code,
		"BAD_USER_INPUT",
		"only https push services",
	);
	assert.ok((await gql(null, SUB, { e: endpoint, p: "k", a: "a" })).errors, "signed-out people can't subscribe");

	assert.equal((await gql(ann, SUB, { e: endpoint, p: "k", a: "a" })).data?.subscribePush, true);
	assert.equal(await owner(), ann.id);
	await gql(bob, SUB, { e: endpoint, p: "k2", a: "a2" });
	assert.equal(await owner(), bob.id, "the browser moved to Bob's account");

	await gql(ann, UNSUB, { e: endpoint });
	assert.equal(await owner(), bob.id, "Ann can't remove Bob's device");
	await gql(bob, UNSUB, { e: endpoint });
	assert.equal(await owner(), undefined);

	assert.equal((await gql(bob, `mutation { testPush }`)).data?.testPush, 0, "no devices, nothing sent");
});
