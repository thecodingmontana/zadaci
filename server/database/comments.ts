import { index, text, varchar } from "drizzle-orm/pg-core";
import { project, task } from "./project";
import { generateNanoId, pgTable, syncable } from "./utils";
import { workspace_members } from "./workspace";

// Kept separate from `message` (chat) on purpose — comments are scoped to
// a task/project and are part of that entity's permanent record, whereas
// messages live in a channel's timeline. They look similar but have
// different retention/notification needs, so two collections is simpler
// than one polymorphic table.

export const task_comment = pgTable(
  "task_comment",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    task_id: varchar("task_id", { length: 16 })
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    author_id: varchar("author_id", { length: 16 })
      .notNull()
      .references(() => workspace_members.id),
    content: text("content").notNull(),
    ...syncable,
  },
  (table) => [index("task_comment_task_id_idx").on(table.task_id)],
);

export const project_comment = pgTable(
  "project_comment",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    project_id: varchar("project_id", { length: 16 })
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    author_id: varchar("author_id", { length: 16 })
      .notNull()
      .references(() => workspace_members.id),
    content: text("content").notNull(),
    ...syncable,
  },
  (table) => [index("project_comment_project_id_idx").on(table.project_id)],
);
