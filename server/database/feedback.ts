import { text, varchar } from "drizzle-orm/pg-core";
import { user } from "./user";
import { generateNanoId, pgTable, timestamps } from "./utils";

export const feedback = pgTable("feedback", {
  id: varchar("id", { length: 16 })
    .primaryKey()
    .$defaultFn(() => generateNanoId()),
  user_id: varchar("user_id", { length: 16 })
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(),
  message: text("message").notNull(),
  ...timestamps,
});
