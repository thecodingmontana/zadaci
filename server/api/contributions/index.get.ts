import { desc, sql } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface ContributionDay {
  date: string;
  count: number;
}

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const userId = session.user.id;

    // Last 365 days of per-day contribution totals for this user.
    const rows = await db
      .select({
        date: tables.contribution.contribution_date,
        count: sql<number>`coalesce(sum(${tables.contribution.count}), 0)`,
      })
      .from(tables.contribution)
      .where(
        sql`${tables.contribution.user_id} = ${userId}
          and ${tables.contribution.contribution_date} >= (current_date - interval '364 days')`,
      )
      .groupBy(tables.contribution.contribution_date)
      .orderBy(desc(tables.contribution.contribution_date));

    const days: ContributionDay[] = rows.map((row) => ({
      date: typeof row.date === "string" ? row.date : new Date(row.date).toISOString().slice(0, 10),
      count: Number(row.count),
    }));

    return { days };
  } catch (error: any) {
    if (error?.statusCode) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to load contributions: ${error?.message || "Unknown error"}`,
    });
  }
});
