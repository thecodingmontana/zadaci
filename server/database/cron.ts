import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const cron_job = pgTable("cron_jobs", {
  id: uuid().notNull().primaryKey().defaultRandom(),
  message: text("message"),
  created_at: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  }).defaultNow(),
});
