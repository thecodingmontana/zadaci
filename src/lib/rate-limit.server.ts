import { sql } from "drizzle-orm";
import { db, tables } from "#/db";

/**
 * Takes `adding` from a budget of `max` per `windowMs` under `key`; false when that would go over.
 * One atomic statement, so requests at the same moment (on any server) can't both slip under it.
 */
export async function takeAllowance(
	key: string,
	adding: number,
	max: number,
	windowMs: number,
) {
	if (adding > max) return false;
	const now = Date.now();
	const fresh = sql`${tables.rateLimit.lastRequest} < ${now - windowMs}`;
	const take = () =>
		db
			.insert(tables.rateLimit)
			.values({ id: key, key, count: adding, lastRequest: now })
			.onConflictDoUpdate({
				target: tables.rateLimit.key,
				set: {
					count: sql`case when ${fresh} then ${adding} else ${tables.rateLimit.count} + ${adding} end`,
					lastRequest: sql`case when ${fresh} then ${now} else ${tables.rateLimit.lastRequest} end`,
				},
				setWhere: sql`${fresh} or ${tables.rateLimit.count} + ${adding} <= ${max}`,
			})
			.returning({ count: tables.rateLimit.count });
	// two first requests at once both insert, and the loser trips the primary key (the same value
	// as key) rather than the conflict target: run it again, as an update this time
	const [taken] = await take().catch(
		(error: { code?: string; cause?: { code?: string } }) => {
			if ((error.cause?.code ?? error.code) === "23505") return take();
			throw error;
		},
	);
	return !!taken;
}
