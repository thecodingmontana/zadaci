import { sql } from "drizzle-orm";
import { index, pgPolicy, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { USER_ROLE, user_role_enum } from "./enums";
import { user } from "./user";
import { generateNanoId, pgTable, timestamps } from "./utils";

export const workspace = pgTable(
  "workspace",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    name: varchar("name", { length: 255 }).notNull(),
    image_url: text("image_url").notNull(),
    invite_code: text("invite_code").notNull().unique(),
    user_id: varchar("user_id", { length: 16 })
      .notNull()
      .references(() => user.id),
    ...timestamps,
  },
  (table) => [
    index("workspace_user_id_idx").on(table.user_id),
    index("workspace_name_id_idx").on(table.name, table.id),
    pgPolicy("allow_anon_select_workspace", { for: "select", to: "anon", using: sql`true` }),
  ],
);

export const workspace_members = pgTable(
  "workspace_members",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    role: user_role_enum("role").notNull().default(USER_ROLE.MEMBER),
    user_id: varchar("user_id", { length: 16 })
      .notNull()
      .references(() => user.id),
    workspace_id: varchar("workspace_id", { length: 16 })
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    index("workspace_members_user_id_idx").on(table.user_id),
    index("workspace_members_workspace_id_idx").on(table.workspace_id),
    pgPolicy("allow_anon_select_workspace_members", {
      for: "select",
      to: "anon",
      using: sql`true`,
    }),
  ],
);

export const workspace_invite_request = pgTable(
  "workspace_invite_request",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    email: varchar("email", { length: 255 }).notNull(),
    role: user_role_enum("role").notNull().default(USER_ROLE.MEMBER),
    workspace_id: varchar("workspace_id", { length: 16 })
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    expires_at: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    invited_by: varchar("invited_by", { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    index("workspace_invite_workspace_id_idx").on(table.workspace_id),
    index("workspace_invite_invited_by_idx").on(table.invited_by),
    pgPolicy("allow_anon_select_workspace_invite", { for: "select", to: "anon", using: sql`true` }),
  ],
);
