import {
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { user } from "./user";
import { pgTable as appTable } from "./utils";

export const cronJobs = pgTable("cron_jobs", {
	id: uuid("id").primaryKey().defaultRandom(),
	message: text("message").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export type CronJob = typeof cronJobs.$inferSelect;
export type NewCronJob = typeof cronJobs.$inferInsert;

// One row per person per local day once their morning reminders and digest went out,
// so an hourly cron that runs late, twice or in parallel never sends them twice.
export const daily_sent = appTable(
	"daily_sent",
	{
		user_id: varchar("user_id", { length: 16 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		day: varchar("day", { length: 10 }).notNull(),
		created_at: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.user_id, table.day] })],
);
