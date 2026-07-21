import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgPolicy,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { channel_type_enum } from "./enums";
import { user } from "./user";
import { generateNanoId, pgTable, syncable, timestamps } from "./utils";
import { workspace, workspace_members } from "./workspace";

export const channel = pgTable(
  "channel",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    workspace_id: varchar("workspace_id", { length: 16 })
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    type: channel_type_enum("type").notNull().default("public"),
    created_by: varchar("created_by", { length: 16 })
      .notNull()
      .references(() => user.id),
    ...syncable,
  },
  (table) => [
    index("channel_workspace_id_idx").on(table.workspace_id),
    pgPolicy("allow_anon_select_channel", { for: "select", to: "anon", using: sql`true` }),
  ],
);

export const channel_members = pgTable(
  "channel_members",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    channel_id: varchar("channel_id", { length: 16 })
      .notNull()
      .references(() => channel.id, { onDelete: "cascade" }),
    member_id: varchar("member_id", { length: 16 })
      .notNull()
      .references(() => workspace_members.id, { onDelete: "cascade" }),
    last_read_at: timestamp("last_read_at", {
      mode: "date",
      precision: 3,
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    index("channel_members_channel_id_idx").on(table.channel_id),
    index("channel_members_member_id_idx").on(table.member_id),
    pgPolicy("allow_anon_select_channel_members", { for: "select", to: "anon", using: sql`true` }),
  ],
);

export const message = pgTable(
  "message",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    channel_id: varchar("channel_id", { length: 16 })
      .notNull()
      .references(() => channel.id, { onDelete: "cascade" }),
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
    parent_message_id: varchar("parent_message_id", { length: 16 }).references(() => message.id, {
      onDelete: "set null",
    }),
    thread_reply_count: integer("thread_reply_count").notNull().default(0),
    thread_participant_ids: jsonb("thread_participant_ids").notNull().default([]),
    thread_last_reply_at: timestamp("thread_last_reply_at", {
      mode: "date",
      precision: 3,
      withTimezone: true,
    }),
    ...syncable,
  },
  (table) => [
    index("message_channel_id_idx").on(table.channel_id),
    index("message_parent_message_id_idx").on(table.parent_message_id),
    index("message_thread_last_reply_at_idx").on(table.thread_last_reply_at),
    pgPolicy("allow_anon_select_message", { for: "select", to: "anon", using: sql`true` }),
  ],
);

export const message_receipt = pgTable(
  "message_receipt",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    message_id: varchar("message_id", { length: 16 })
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    member_id: varchar("member_id", { length: 16 })
      .notNull()
      .references(() => workspace_members.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull().default("delivered"),
    ...timestamps,
  },
  (table) => [
    index("message_receipt_message_id_idx").on(table.message_id),
    index("message_receipt_member_id_idx").on(table.member_id),
    uniqueIndex("message_receipt_message_member_unique").on(table.message_id, table.member_id),
    pgPolicy("allow_anon_select_message_receipt", { for: "select", to: "anon", using: sql`true` }),
  ],
);

export const message_reference = pgTable(
  "message_reference",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    message_id: varchar("message_id", { length: 16 })
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    ref_type: varchar("ref_type", { length: 20 }).notNull().default("link"),
    ref_id: varchar("ref_id", { length: 16 }),
    snapshot: text("snapshot"),
    ...timestamps,
  },
  (table) => [
    index("message_reference_message_id_idx").on(table.message_id),
    pgPolicy("allow_anon_select_message_reference", {
      for: "select",
      to: "anon",
      using: sql`true`,
    }),
  ],
);
