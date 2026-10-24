import { and, eq, sql } from "drizzle-orm";
import { db, tables } from "#/db";

// Per-person limits, so one person can't use up the account's free requests for everyone.

export const dailyLimit = () => {
	const n = Number.parseInt(process.env.AI_DAILY_LIMIT ?? "", 10);
	return Number.isFinite(n) && n > 0 ? n : 30;
};

/** Counts one message for today; false when the person has reached the daily limit. */
export async function takeMessage(userId: string, day: string) {
	const limit = dailyLimit();
	const rows = await db
		.insert(tables.ai_usage)
		.values({ user_id: userId, day, count: 1 })
		.onConflictDoUpdate({
			target: [tables.ai_usage.user_id, tables.ai_usage.day],
			set: { count: sql`${tables.ai_usage.count} + 1` },
			// a full day is left as it is, so the check and the count are one atomic step
			setWhere: sql`${tables.ai_usage.count} < ${limit}`,
		})
		.returning({ count: tables.ai_usage.count });
	return rows.length > 0;
}

/** Gives back a message that got no answer (every model failed, or the account was out). */
export async function refundMessage(userId: string, day: string) {
	await db
		.update(tables.ai_usage)
		.set({ count: sql`greatest(${tables.ai_usage.count} - 1, 0)` })
		.where(
			and(eq(tables.ai_usage.user_id, userId), eq(tables.ai_usage.day, day)),
		);
}

/** The text of the newest message, whatever shape the browser sent it in. */
export function lastUserText(messages: unknown[]) {
	const last = messages.at(-1) as
		| {
				role?: string;
				content?: unknown;
				parts?: { type: string; content?: unknown }[];
		  }
		| undefined;
	if (last?.role !== "user") return null;
	if (typeof last.content === "string") return last.content;
	const parts = last.parts ?? (Array.isArray(last.content) ? last.content : []);
	return parts
		.map((p: { type?: string; content?: unknown; text?: unknown }) =>
			typeof p.content === "string"
				? p.content
				: typeof p.text === "string"
					? p.text
					: "",
		)
		.join("");
}
