import assert from "node:assert/strict";
import { after, test } from "node:test";
import { db, tables } from "#/db";
import { auth } from "#/lib/auth";
import { cleanup, makeUser } from "./helpers";

after(cleanup);

/** Asks for a link the way the sign-in form does, and returns it (it's printed without Resend). */
async function linkFor(email: string) {
	const said: string[] = [];
	const info = console.info;
	console.info = (...a: unknown[]) => said.push(a.join(" "));
	try {
		const res = await auth.handler(
			new Request("http://localhost:3000/api/auth/sign-in/magic-link", {
				method: "POST",
				headers: { "content-type": "application/json", origin: "http://localhost:3000" },
				body: JSON.stringify({ email, callbackURL: "/workspace" }),
			}),
		);
		assert.equal(res.status, 200);
	} finally {
		console.info = info;
	}
	const url = said.join("\n").match(/https?:\/\/\S+magic-link\/verify\S+/)?.[0];
	assert.ok(url, "a link was sent");
	return url;
}

const open = (url: string) => auth.handler(new Request(url, { headers: { origin: "http://localhost:3000" } }));

test("a sign-in link signs in once, and never skips two-step verification", async () => {
	const plain = await makeUser("plain", false);
	const first = await open(await linkFor(plain.email));
	assert.equal(first.status, 302);
	assert.match(first.headers.get("location") ?? "", /\/workspace/);
	assert.match(first.headers.get("set-cookie") ?? "", /session_token=/, "signed in");

	const secured = await makeUser("secured", true);
	const link = await linkFor(secured.email);
	const res = await open(link);
	assert.match(res.headers.get("location") ?? "", /\/auth\/two-factor/, "sent to the second step");
	assert.doesNotMatch(res.headers.get("set-cookie") ?? "", /session_token=[^;]{10,}/, "no session yet");

	const fresh = `new.person-${Date.now()}@test.zadaci`;
	await open(await linkFor(fresh));
	const { db, tables } = await import("#/db");
	const { eq } = await import("drizzle-orm");
	const [made] = await db.select().from(tables.user).where(eq(tables.user.email, fresh));
	assert.match(made?.name ?? "", /^New Person/, "a new account gets a name from its email");
	await db.delete(tables.user).where(eq(tables.user.email, fresh));

	const again = await open(link);
	assert.match(again.headers.get("location") ?? "", /error=/, "the same link can't be used twice");
});

test("sign-in emails are limited per address, counted in the database so it holds on every server", async () => {
	const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
	const statuses: number[] = [];
	for (let i = 0; i < 6; i++) {
		const res = await auth.handler(
			new Request("http://localhost:3000/api/auth/sign-in/magic-link", {
				method: "POST",
				headers: { "content-type": "application/json", origin: "http://localhost:3000", "x-forwarded-for": ip },
				body: JSON.stringify({ email: `flood-${i}@test.zadaci`, callbackURL: "/workspace" }),
			}),
		);
		statuses.push(res.status);
	}
	assert.equal(statuses.at(-1), 429, `the sixth request in a minute is refused (${statuses.join(",")})`);
	const { db, tables } = await import("#/db");
	assert.ok((await db.select().from(tables.rateLimit)).length > 0, "the count lives in Postgres");
});

test("one address gets at most 5 sign-in links an hour, whoever asks", async () => {
	const person = await makeUser("flooded", false);
	// 5 already sent this hour (asking for them here would trip the per-IP limit first)
	const key = `magic-link:${person.email.toLowerCase()}`;
	await db.insert(tables.rateLimit).values({ id: key, key, count: 5, lastRequest: Date.now() });
	const res = await auth.handler(
		new Request("http://localhost:3000/api/auth/sign-in/magic-link", {
			method: "POST",
			headers: { "content-type": "application/json", origin: "http://localhost:3000" },
			body: JSON.stringify({ email: person.email.toUpperCase(), callbackURL: "/workspace" }),
		}),
	);
	assert.equal(res.status, 429, "the sixth is refused, however the address is written");
	assert.ok(await linkFor((await makeUser("other", false)).email), "someone else still gets theirs");
});
