import { sql } from "drizzle-orm";
import { index, pgPolicy, varchar } from "drizzle-orm/pg-core";
import { generateNanoId, pgTable, syncable, timestamps } from "./utils";
import { workspace, workspace_members } from "./workspace";

export const team = pgTable(
  "team",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    workspace_id: varchar("workspace_id", { length: 16 })
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    color: varchar("color", { length: 20 }),
    ...syncable,
  },
  (table) => [
    index("team_workspace_id_idx").on(table.workspace_id),
    pgPolicy("allow_anon_select_team", { for: "select", to: "anon", using: sql`true` }),
  ],
);

export const team_members = pgTable(
  "team_members",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    team_id: varchar("team_id", { length: 16 })
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    member_id: varchar("member_id", { length: 16 })
      .notNull()
      .references(() => workspace_members.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    index("team_members_team_id_idx").on(table.team_id),
    index("team_members_member_id_idx").on(table.member_id),
    pgPolicy("allow_anon_select_team_members", { for: "select", to: "anon", using: sql`true` }),
  ],
);
