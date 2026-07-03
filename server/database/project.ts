import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { PRIORITY, priority_enum, STATUS, status_enum } from "./enums";
import { timestamps } from "./utils";
import { workspace, workspace_members } from "./workspace";

export const project = pgTable(
  "project",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    status: status_enum("status").default(STATUS.IDEA).notNull(),
    priority: priority_enum("priority").default(PRIORITY.NONE).notNull(),
    workspace_id: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    due_date: timestamp("due_date", { mode: "date" }),
    ...timestamps,
  },
  (table) => ({
    project_workspace_id_idx: index("project_workspace_id_idx").on(
      table.workspace_id
    ),
  })
);

export const project_members = pgTable(
  "project_members",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    member_id: text("member_id")
      .notNull()
      .references(() => workspace_members.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => ({
    project_members_project_id_idx: index("project_members_project_id_idx").on(
      table.project_id
    ),
    project_members_member_id_idx: index("project_members_member_id_idx").on(
      table.member_id
    ),
  })
);

export const task = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    status: status_enum("status").default(STATUS.IDEA).notNull(),
    priority: priority_enum("priority").default(PRIORITY.NONE).notNull(),
    project_id: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    due_date: timestamp("due_date", { mode: "date" }),
    ...timestamps,
  },
  (table) => ({
    tasks_project_id_idx: index("tasks_project_id_idx").on(table.project_id),
  })
);

export const task_assignees = pgTable(
  "task_assignees",
  {
    id: text("id").primaryKey(),
    task_id: text("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    member_id: text("member_id")
      .notNull()
      .references(() => workspace_members.id, { onDelete: "cascade" }),
    assigned_at: timestamp("assigned_at", {
      mode: "date",
      precision: 3,
    }).notNull(),
    ...timestamps,
  },
  (table) => ({
    task_assignees_task_id_idx: index("task_assignees_task_id_idx").on(
      table.task_id
    ),
    task_assignees_member_id_idx: index("task_assignees_member_id_idx").on(
      table.member_id
    ),
  })
);

export const tasks_activity = pgTable(
  "tasks_activity",
  {
    id: text("id").primaryKey(),
    status: status_enum("status").default(STATUS.IDEA).notNull(),
    task_id: text("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    changed_by: text("changed_by")
      .notNull()
      .references(() => workspace_members.id, { onDelete: "cascade" }),
    changed_at: timestamp("changed_at", {
      mode: "date",
      precision: 3,
    }).notNull(),
    ...timestamps,
  },
  (table) => ({
    tasks_activity_task_id_idx: index("tasks_activity_task_id_idx").on(
      table.task_id
    ),
    tasks_activity_changed_by_idx: index("tasks_activity_changed_by_idx").on(
      table.changed_by
    ),
  })
);

export const subtasks = pgTable(
  "subtasks",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    task_id: text("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    is_completed: boolean("is_completed").default(false).notNull(),
    ...timestamps,
  },
  (table) => ({
    subtasks_task_id_idx: index("subtasks_task_id_idx").on(table.task_id),
  })
);
