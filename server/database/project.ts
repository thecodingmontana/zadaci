import { index, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { PRIORITY, priority_enum, STATUS, status_enum } from "./enums";
import { team } from "./team";
import { generateNanoId, pgTable, syncable, timestamps } from "./utils";
import { workspace, workspace_members } from "./workspace";

export const project = pgTable(
  "project",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    title: text("title").notNull(),
    description: text("description"),
    status: status_enum("status").default(STATUS.IDEA).notNull(),
    priority: priority_enum("priority").default(PRIORITY.NONE).notNull(),
    workspace_id: varchar("workspace_id", { length: 16 })
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    team_id: varchar("team_id", { length: 16 }).references(() => team.id, {
      onDelete: "set null",
    }),
    due_date: timestamp("due_date", { mode: "date" }),
    ...syncable,
  },
  (table) => [
    index("project_workspace_id_idx").on(table.workspace_id),
    index("project_team_id_idx").on(table.team_id),
  ],
);

export const project_members = pgTable(
  "project_members",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    project_id: varchar("project_id", { length: 16 })
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    member_id: varchar("member_id", { length: 16 })
      .notNull()
      .references(() => workspace_members.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    index("project_members_project_id_idx").on(table.project_id),
    index("project_members_member_id_idx").on(table.member_id),
  ],
);

export const task = pgTable(
  "tasks",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    name: text("name").notNull(),
    description: text("description"),
    status: status_enum("status").default(STATUS.IDEA).notNull(),
    priority: priority_enum("priority").default(PRIORITY.NONE).notNull(),
    project_id: varchar("project_id", { length: 16 })
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    parent_task_id: varchar("parent_task_id", { length: 16 }).references(() => task.id, {
      onDelete: "set null",
    }),
    due_date: timestamp("due_date", { mode: "date" }),
    ...syncable,
  },
  (table) => [
    index("tasks_project_id_idx").on(table.project_id),
    index("tasks_parent_task_id_idx").on(table.parent_task_id),
  ],
);

export const task_assignees = pgTable(
  "task_assignees",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    task_id: varchar("task_id", { length: 16 })
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    member_id: varchar("member_id", { length: 16 })
      .notNull()
      .references(() => workspace_members.id, { onDelete: "cascade" }),
    assigned_at: timestamp("assigned_at", {
      mode: "date",
      precision: 3,
    }).notNull(),
    ...syncable,
  },
  (table) => [
    index("task_assignees_task_id_idx").on(table.task_id),
    index("task_assignees_member_id_idx").on(table.member_id),
  ],
);

export const tasks_activity = pgTable(
  "tasks_activity",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    status: status_enum("status").default(STATUS.IDEA).notNull(),
    task_id: varchar("task_id", { length: 16 })
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    changed_by: varchar("changed_by", { length: 16 })
      .notNull()
      .references(() => workspace_members.id, { onDelete: "cascade" }),
    changed_at: timestamp("changed_at", {
      mode: "date",
      precision: 3,
    }).notNull(),
    ...syncable,
  },
  (table) => [
    index("tasks_activity_task_id_idx").on(table.task_id),
    index("tasks_activity_changed_by_idx").on(table.changed_by),
  ],
);
