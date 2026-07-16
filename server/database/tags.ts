import { index, varchar } from "drizzle-orm/pg-core";
import { project, task } from "./project";
import { generateNanoId, pgTable, syncable, timestamps } from "./utils";
import { workspace } from "./workspace";

export const tag = pgTable(
  "tag",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    workspace_id: varchar("workspace_id", { length: 16 })
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    color: varchar("color", { length: 20 }),
    ...syncable,
  },
  (table) => [index("tag_workspace_id_idx").on(table.workspace_id)],
);

export const project_tags = pgTable(
  "project_tags",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    project_id: varchar("project_id", { length: 16 })
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    tag_id: varchar("tag_id", { length: 16 })
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    index("project_tags_project_id_idx").on(table.project_id),
    index("project_tags_tag_id_idx").on(table.tag_id),
  ],
);

export const task_tags = pgTable(
  "task_tags",
  {
    id: varchar("id", { length: 16 })
      .primaryKey()
      .$defaultFn(() => generateNanoId()),
    task_id: varchar("task_id", { length: 16 })
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    tag_id: varchar("tag_id", { length: 16 })
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    index("task_tags_task_id_idx").on(table.task_id),
    index("task_tags_tag_id_idx").on(table.tag_id),
  ],
);
