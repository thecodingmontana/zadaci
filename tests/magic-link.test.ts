import assert from "node:assert/strict";
import { after, test } from "node:test";
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
