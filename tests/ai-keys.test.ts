import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { activeKey, openKey, sealKey } from "#/lib/ai/keys.server";
import { cleanup, gql, makeUser } from "./helpers";

after(cleanup);

const KEY = `sk-ant-${"x".repeat(30)}a1b2`;
const STATUS = "keys { provider hint model active } used limit";

test("a saved key is encrypted, bound to its owner, and never sent back", async () => {
	const sealed = sealKey(KEY, "user1", "anthropic");
	assert.ok(!sealed.includes(KEY));
	assert.equal(openKey(sealed, "user1", "anthropic"), KEY);
	assert.equal(openKey(sealed, "user2", "anthropic"), null, "copied to another account it reads as nothing");
	assert.equal(openKey(sealed, "user1", "openai"), null, "or to another provider");
});

test("people add keys for several providers, pick the active one, and remove them", async () => {
	const amina = await makeUser("amina");
	// the provider check is a network call; stand in for it here
	const realFetch = globalThis.fetch;
	globalThis.fetch = (async () => new Response("{}", { status: 200 })) as typeof fetch;
	try {
		const bad = await gql(amina, `mutation { setAiKey(provider: "anthropic", key: "nope") { used } }`);
		assert.match(bad.errors?.[0]?.message ?? "", /doesn't look like/);
		const saved = (
			await gql(amina, `mutation($k: String!) { setAiKey(provider: "anthropic", key: $k) { ${STATUS} } }`, { k: KEY })
		).data?.setAiKey;
		assert.deepEqual(saved.keys, [{ provider: "anthropic", hint: "…a1b2", model: "claude-sonnet-5-5", active: true }]);
		assert.ok(!JSON.stringify(saved).includes(KEY), "the key never comes back");
		const [row] = await db.select().from(tables.ai_user_key).where(eq(tables.ai_user_key.user_id, amina.id));
		assert.ok(row && !row.cipher.includes(KEY), "stored encrypted");
		assert.equal((await activeKey(amina.id))?.key, KEY);

		await gql(amina, `mutation($k: String!) { setAiKey(provider: "openai", key: $k) { used } }`, { k: `sk-${"y".repeat(40)}` });
		assert.equal((await activeKey(amina.id))?.provider, "openai", "the newest key becomes active");
		await gql(amina, `mutation { useAiKey(provider: "anthropic") { used } }`);
		assert.equal((await activeKey(amina.id))?.provider, "anthropic");
		await gql(amina, `mutation { useAiKey(provider: null) { used } }`);
		assert.equal(await activeKey(amina.id), null, "back to the shared free models");
		await gql(amina, `mutation { removeAiKey(provider: "anthropic") { used } }`);
		const left = (await gql(amina, `{ aiStatus { ${STATUS} } }`)).data?.aiStatus;
		assert.deepEqual(left.keys.map((k: { provider: string }) => k.provider), ["openai"]);
		assert.equal(left.limit, 2, "two free messages a day without a key");
	} finally {
		globalThis.fetch = realFetch;
	}
});

test("checking keys is capped at 10 an hour, before the provider is asked", async () => {
	const sam = await makeUser("sam");
	const key = `ai-key-checks:${sam.id}`;
	await db.insert(tables.rateLimit).values({ id: key, key, count: 10, lastRequest: Date.now() });
	let asked = 0;
	const realFetch = globalThis.fetch;
	globalThis.fetch = (async () => {
		asked++;
		return new Response("{}", { status: 200 });
	}) as typeof fetch;
	try {
		const res = await gql(sam, `mutation($k: String!) { setAiKey(provider: "anthropic", key: $k) { used } }`, { k: KEY });
		assert.match(res.errors?.[0]?.message ?? "", /Too many key checks/);
		assert.equal(asked, 0, "no call to the provider");
	} finally {
		globalThis.fetch = realFetch;
	}
});
