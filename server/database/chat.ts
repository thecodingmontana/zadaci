import { index, text, timestamp, varchar } from "drizzle-orm/pg-core";
import {
  CHANNEL_TYPE,
  channel_type_enum,
  MESSAGE_REFERENCE_TYPE,
  message_reference_type_enum,
} from "./enums";
import { user } from "./user";
import { generateNanoId, pgTable, syncable, timestamps } from "./utils";
import { workspace, workspace_members } from "./workspace";

// A DM is just a channel with type "dm" and exactly 2 members —
// no separate DM table needed.
export const channel = pgTable(
  "channel",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    workspace_id: varchar("workspace_id", { length: 16 })
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }), // null for dm
    type: channel_type_enum("type").notNull().default(CHANNEL_TYPE.PUBLIC),
    created_by: varchar("created_by", { length: 16 })
      .notNull()
      .references(() => user.id),
    ...syncable,
  },
  (table) => [index("channel_workspace_id_idx").on(table.workspace_id)],
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
    // drives unread badges — messages after this timestamp are "unread"
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
    ...syncable,
  },
  (table) => [index("message_channel_id_idx").on(table.channel_id)],
);

// Lets a message carry a pointer to a task/project/file/link instead of
// duplicating that entity's data. `snapshot` caches title/status/url at
// share-time so the reference card renders instantly without a join —
// it's a display cache, not the source of truth.
export const message_reference = pgTable(
  "message_reference",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    message_id: varchar("message_id", { length: 16 })
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    ref_type: message_reference_type_enum("ref_type")
      .notNull()
      .default(MESSAGE_REFERENCE_TYPE.LINK),
    ref_id: varchar("ref_id", { length: 16 }), // null for plain 'link' type
    snapshot: text("snapshot"), // JSON string: cached title/status/url
    ...timestamps,
  },
  (table) => [index("message_reference_message_id_idx").on(table.message_id)],
);
