import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import { eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { adminDashboard } from "#/lib/admin-analytics.server";
import { adminDirectory, adminSystem } from "#/lib/admin.server";
import { isAdmin, recordError, recordJobRun } from "#/lib/ops.server";
import { cleanup, makeUser } from "./helpers";

after(cleanup);

// The admin page: only listed addresses get in, and it shows kept errors and the hourly job.

test("admin: only the addresses ADMIN_EMAILS lists, however they're written", () => {
	process.env.ADMIN_EMAILS = " Boss@Zadaci.app , ops@zadaci.app";
	assert.equal(isAdmin("boss@zadaci.app"), true);
	assert.equal(isAdmin("OPS@zadaci.app"), true);
	assert.equal(isAdmin("someone@zadaci.app"), false);
	assert.equal(isAdmin(""), false);
	assert.equal(isAdmin(null), false);
	process.env.ADMIN_EMAILS = "";
	assert.equal(isAdmin("boss@zadaci.app"), false, "nobody when it's empty");
});

test("admin: errors are kept for the page, the hourly run is noted, and old errors are pruned", async () => {
	await makeUser("admin-counts", false);
	const log = mock.method(console, "error", () => {});
	try {
		await recordError("github", "octo/board#7: GitHub answered 403");
	} finally {
		log.mock.restore();
	}
	const old = await db
		.insert(tables.error_log)
		.values({ source: "client", message: "ancient", at: new Date(Date.now() - 20 * 86_400_000) })
		.returning();
	await recordJobRun("hourly", true, { people: 1, github: 0 });

	assert.equal((await db.select().from(tables.error_log).where(eq(tables.error_log.id, old[0].id))).length, 0, "older than 14 days: gone");
	const system = await adminSystem();
	assert.ok(system.errors.some((e) => e.source === "github" && e.message.includes("403")));
	assert.ok((system.errorsDay.github ?? 0) >= 1);
	assert.equal(system.errorsDaily.length, 30);
	assert.ok((system.errorsDaily.at(-1)?.github ?? 0) >= 1, "today's GitHub error is in the chart");
	const hourly = system.jobs.find((j) => j.name === "hourly");
	assert.equal(hourly?.ok, true);
	assert.equal(hourly?.result.people, 1);
	assert.ok(system.database.bytes > 0 && system.database.biggest.length > 0);
});

test("admin: the dashboard's 60 days line up with today, and the directory lists people and workspaces", async () => {
	const me = await makeUser("admin-dash", false);
	const dash = await adminDashboard();
	assert.equal(dash.daily.length, 60);
	assert.equal(dash.daily.at(-1)?.day, new Date().toISOString().slice(0, 10));
	assert.ok((dash.daily.at(-1)?.signups ?? 0) >= 1, "today's sign-up is counted today");
	assert.ok(dash.totals.people >= 1 && dash.statuses.length >= 0);
	assert.equal(dash.heatmap.length, 182);
	const dir = await adminDirectory();
	assert.ok(dir.people.some((p) => p.email === me.email && p.joined));
	assert.ok(Array.isArray(dir.workspaces));
});
