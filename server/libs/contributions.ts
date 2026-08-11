import { sql } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export const CONTRIBUTION_SOURCES = {
  LOGIN: "login",
  TASK_CREATED: "task_created",
  PROJECT_CREATED: "project_created",
  TASK_COMPLETED: "task_completed",
  COMMENT_CREATED: "comment_created",
  NOTE_CREATED: "note_created",
  MESSAGE_SENT: "message_sent",
  DIRECT_MESSAGE_SENT: "direct_message_sent",
} as const;

export type ContributionSource = (typeof CONTRIBUTION_SOURCES)[keyof typeof CONTRIBUTION_SOURCES];

/**
 * Records one contribution for a user on a given day.
 *
 * Each (user_id, contribution_date, source) pair is unique — calling this
 * again for the same day+source increments `count` instead of creating a
 * duplicate row. This means a "login" can never stack, while creating many
 * tasks in one day accumulates toward the grid levels.
 *
 * Fires-and-forgets: failures are logged, never thrown, so contribution
 * tracking can never break the underlying user action.
 */
export async function recordContribution(
  userId: string,
  source: ContributionSource,
  date: Date = new Date(),
): Promise<void> {
  if (!userId) return;
  const contributionDate = date.toISOString().slice(0, 10);
  try {
    await db
      .insert(tables.contribution)
      .values({
        user_id: userId,
        contribution_date: contributionDate,
        source,
        count: 1,
      })
      .onConflictDoUpdate({
        target: [
          tables.contribution.user_id,
          tables.contribution.contribution_date,
          tables.contribution.source,
        ],
        set: {
          count: sql`${tables.contribution.count} + 1`,
          updated_at: new Date(),
        },
      });
  } catch (err: any) {
    console.error(`[contribution] Failed to record ${source}:`, err?.message || err);
  }
}
