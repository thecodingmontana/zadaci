import { timestamp } from "drizzle-orm/pg-core";

export const timestamps = {
  created_at: timestamp("created_at", {
    mode: "date",
    precision: 3,
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  updated_at: timestamp("updated_at", {
    mode: "date",
    precision: 3,
    withTimezone: true,
  })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
};
