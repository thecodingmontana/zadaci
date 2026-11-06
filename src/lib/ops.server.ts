import { notFound } from "@tanstack/react-router";
import { lt } from "drizzle-orm";
import { db, tables } from "#/db";
import { auth } from "#/lib/auth";

// What the admin page (/admin) watches: errors and background job runs, kept in the database
// because the host's logs only last an hour.

const KEEP_DAYS = 14;

/** Log an error and keep it for the admin page. Never throws: a failed write only logs. */
export async function recordError(
	source: "client" | "github" | "cron",
	message: string,
) {
	console.error(`[${source}] ${message}`);
	await db
		.insert(tables.error_log)
		.values({ source, message: message.slice(0, 2000) })
		.catch((error) =>
			console.error("[ops] couldn't keep an error:", String(error)),
		);
}

/** Note a background job's run (the latest one per job is kept), and prune old errors. */
export async function recordJobRun(name: string, ok: boolean, result: object) {
	const values = { name, at: new Date(), ok, result };
	await db
		.insert(tables.job_run)
		.values(values)
		.onConflictDoUpdate({ target: tables.job_run.name, set: values });
	await db
		.delete(tables.error_log)
		.where(
			lt(tables.error_log.at, new Date(Date.now() - KEEP_DAYS * 86_400_000)),
		);
}

/** Whoever ADMIN_EMAILS lists (comma-separated) can open /admin. */
export function isAdmin(email: string | null | undefined) {
	if (!email) return false;
	return (process.env.ADMIN_EMAILS ?? "")
		.toLowerCase()
		.split(",")
		.map((e) => e.trim())
		.includes(email.toLowerCase());
}

/** Throws "not found" unless these request headers carry an admin's session (the admin data
 * functions call this first). */
export async function checkAdmin(headers: Headers) {
	const session = await auth.api.getSession({ headers });
	if (!isAdmin(session?.user.email)) throw notFound();
}
