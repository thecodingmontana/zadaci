import { date, integer, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { user } from "./user";
import { generateNanoId, pgTable, timestamps } from "./utils";

export const contribution = pgTable(
  "contribution",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    user_id: varchar("user_id", { length: 16 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    contribution_date: date("contribution_date").notNull(),
    source: varchar("source", { length: 32 }).notNull(),
    count: integer("count").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("contribution_user_date_source_unique").on(
      table.user_id,
      table.contribution_date,
      table.source,
    ),
  ],
);
