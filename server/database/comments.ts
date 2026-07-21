import { sql } from "drizzle-orm";
import { index, pgPolicy, text, varchar } from "drizzle-orm/pg-core";
import { generateNanoId, pgTable, syncable } from "./utils";
import { workspace_members } from "./workspace";

export const comment = pgTable(
  "comment",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    entity_type: varchar("entity_type", { length: 50 }).notNull(),
    entity_id: varchar("entity_id", { length: 16 }).notNull(),
    author_id: varchar("author_id", { length: 16 })
      .notNull()
      .references(() => workspace_members.id),
    content: text("content").notNull(),
    parent_id: varchar("parent_id", { length: 16 }).references(() => comment.id, {
      onDelete: "set null",
    }),
    ...syncable,
  },
  (table) => [
    index("comment_entity_idx").on(table.entity_type, table.entity_id),
    index("comment_author_id_idx").on(table.author_id),
    index("comment_parent_id_idx").on(table.parent_id),
    pgPolicy("allow_anon_select_comment", { for: "select", to: "anon", using: sql`true` }),
  ],
);
