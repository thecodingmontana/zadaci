import { sql } from "drizzle-orm";
import { index, jsonb, pgPolicy, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { generateNanoId, pgTable, syncable, timestamps } from "./utils";
import { workspace, workspace_members } from "./workspace";

export const conversation = pgTable(
  "conversation",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    workspace_id: varchar("workspace_id", { length: 16 })
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    member_one_id: varchar("member_one_id", { length: 16 })
      .notNull()
      .references(() => workspace_members.id, { onDelete: "cascade" }),
    member_two_id: varchar("member_two_id", { length: 16 })
      .notNull()
      .references(() => workspace_members.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("conversation_pair_unique").on(table.member_one_id, table.member_two_id),
    index("conversation_workspace_id_idx").on(table.workspace_id),
    index("conversation_member_one_id_idx").on(table.member_one_id),
    index("conversation_member_two_id_idx").on(table.member_two_id),
    pgPolicy("allow_anon_select_conversation", { for: "select", to: "anon", using: sql`true` }),
  ],
);

export const direct_message = pgTable(
  "direct_message",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    conversation_id: varchar("conversation_id", { length: 16 })
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    author_id: varchar("author_id", { length: 16 })
      .notNull()
      .references(() => workspace_members.id),
    content: text("content").notNull(),
    edited_at: timestamp("edited_at", {
      mode: "date",
      precision: 3,
      withTimezone: true,
    }),
    reactions: jsonb("reactions").notNull().default([]),
    ...syncable,
  },
  (table) => [
    index("direct_message_conversation_id_idx").on(table.conversation_id),
    index("direct_message_author_id_idx").on(table.author_id),
    pgPolicy("allow_anon_select_direct_message", { for: "select", to: "anon", using: sql`true` }),
  ],
);

export const direct_message_receipt = pgTable(
  "direct_message_receipt",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    direct_message_id: varchar("direct_message_id", { length: 16 })
      .notNull()
      .references(() => direct_message.id, { onDelete: "cascade" }),
    member_id: varchar("member_id", { length: 16 })
      .notNull()
      .references(() => workspace_members.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull().default("delivered"),
    ...timestamps,
  },
  (table) => [
    index("dm_receipt_message_id_idx").on(table.direct_message_id),
    index("dm_receipt_member_id_idx").on(table.member_id),
    uniqueIndex("dm_receipt_message_member_unique").on(table.direct_message_id, table.member_id),
    pgPolicy("allow_anon_select_dm_receipt", { for: "select", to: "anon", using: sql`true` }),
  ],
);
