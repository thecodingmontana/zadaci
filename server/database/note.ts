import { sql } from "drizzle-orm";
import { index, pgPolicy, text, varchar } from "drizzle-orm/pg-core";
import { generateNanoId, pgTable, syncable } from "./utils";
import { workspace } from "./workspace";

export const note = pgTable(
  "note",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    workspace_id: varchar("workspace_id", { length: 16 })
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content"),
    created_by: varchar("created_by", { length: 16 }).notNull(),
    ...syncable,
  },
  (table) => [
    index("note_workspace_id_idx").on(table.workspace_id),
    pgPolicy("allow_anon_select_note", { for: "select", to: "anon", using: sql`true` }),
  ],
);
