import {
	boolean,
	index,
	jsonb,
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

// Errors kept for the admin page (/admin): the host's logs only last an hour. Browser crashes,
// GitHub writes it refused and the hourly job's failures; pruned after 14 days by that job.
export const error_log = appTable(
	"error_log",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** client, github or cron */
		source: varchar("source", { length: 20 }).notNull(),
		message: text("message").notNull(),
		at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index("error_log_at_idx").on(table.at)],
);

// The last run of each background job, so the admin page shows a job that stopped or ran late.
export const job_run = appTable("job_run", {
	name: varchar("name", { length: 40 }).primaryKey(),
	at: timestamp("at", { withTimezone: true }).notNull(),
	ok: boolean("ok").notNull(),
	result: jsonb("result"),
});
