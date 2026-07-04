import { index, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { USER_ROLE, user_role_enum } from "./enums";
import { user } from "./user";
import { timestamps } from "./utils";

export const workspace = pgTable(
  "workspace",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    image_url: text("image_url").notNull(),
    invite_code: text("invite_code").notNull().unique(),
    user_id: text("user_id")
      .notNull()
      .references(() => user.id),
    ...timestamps,
  },
  (table) => ({
    workspaceUserIdIdx: index("workspace_user_id_idx").on(table.user_id),
    workspaceName: index("workspace_name_id_idx").on(table.name, table.id),
  }),
);

export const workspace_members = pgTable(
  "workspace_members",
  {
    id: text("id").primaryKey(),
    role: user_role_enum("role").notNull().default(USER_ROLE.MEMBER),
    user_id: text("user_id")
      .notNull()
      .references(() => user.id),
    workspace_id: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => ({
    workspaceMembersUserIdIdx: index("workspace_members_user_id_idx").on(table.user_id),
    workspaceMembersWorkspaceIdIdx: index("workspace_members_workspace_id_idx").on(
      table.workspace_id,
    ),
  }),
);

export const workspace_invite_request = pgTable(
  "workspace_invite_request",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    role: user_role_enum("role").notNull().default(USER_ROLE.MEMBER),
    workspace_id: text("workspace_id")
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
  (table) => ({
    workspaceInviteWorkspaceIdIdx: index("workspace_invite_workspace_id_idx").on(
      table.workspace_id,
    ),
    workspaceInviteInvitedByIdx: index("workspace_invite_invited_by_idx").on(table.invited_by),
  }),
);
