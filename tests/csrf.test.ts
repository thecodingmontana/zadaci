import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { yoga } from "#/graphql/yoga.server";
import { crossSite } from "#/lib/same-origin";
import { call } from "./agent";
import { cleanup, makeUser } from "./helpers";

after(cleanup);

// Cross-site requests can't act with someone's session cookie, and the riskiest account changes
// need a recent sign-in, not just a session.

const at = (headers: Record<string, string>) =>
	new Request("https://zadaci.example/api/graphql", { method: "POST", headers });

test("csrf: another site's request is refused; this site's pages and non-browser callers aren't", () => {
	assert.equal(crossSite(at({ origin: "https://evil.example" })), true);
	assert.equal(crossSite(at({ "sec-fetch-site": "cross-site" })), true);
	assert.equal(crossSite(at({ "sec-fetch-site": "same-site" })), true, "a sibling subdomain isn't this site");
	assert.equal(crossSite(at({ origin: "https://zadaci.example", "sec-fetch-site": "same-origin" })), false);
	assert.equal(crossSite(at({})), false, "no browser headers: a server, a test or a webhook");
});

test("csrf: the GraphQL API doesn't hand its answers to other sites (no CORS)", async () => {
	const res = await yoga.fetch(
		new Request("http://localhost:3000/api/graphql", {
			method: "OPTIONS",
			headers: { origin: "https://evil.example", "access-control-request-method": "POST" },
		}),
	);
	assert.equal(res.headers.get("access-control-allow-origin"), null);
	assert.equal(res.headers.get("access-control-allow-credentials"), null);
});

test("2fa: turning it off needs a recent sign-in, not just a session cookie", async () => {
	const me = await makeUser("fresh-2fa"); // has two-factor sign-in on
	const disable = () =>
		call("/api/auth/two-factor/disable", {
			method: "POST",
			cookie: me.cookie,
			headers: { "content-type": "application/json" },
			body: JSON.stringify({}),
		});
	// an hour-old session (a stolen cookie, an unlocked laptop) can't strip the second factor
	await db
		.update(tables.session)
		.set({ createdAt: new Date(Date.now() - 60 * 60 * 1000) })
		.where(eq(tables.session.userId, me.id));
	const stale = await disable();
	assert.equal(stale.status, 403);
	assert.match(await stale.text(), /sign out and back in/);
	// just signed in: it works
	await db.update(tables.session).set({ createdAt: new Date() }).where(eq(tables.session.userId, me.id));
	assert.equal((await disable()).status, 200);
});
