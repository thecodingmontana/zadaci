import { index, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { project, task } from "./project";
import { user } from "./user";
import { generateNanoId, pgTable, timestamps } from "./utils";
import { workspace } from "./workspace";

// Workspace-wide feed for the Activity page: "Ana archived project Atlas".
// `target` keeps the name at the time, so the line still reads right after a rename or delete.
export const activity = pgTable(
	"activity",
	{
		id: varchar("id", { length: 16 })
			.primaryKey()
			.$defaultFn(() => generateNanoId()),
		workspace_id: varchar("workspace_id", { length: 16 })
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		actor_id: varchar("actor_id", { length: 16 }).references(() => user.id, {
			onDelete: "set null",
		}),
		// task | project | member | workspace: drives the page filters
		kind: varchar("kind", { length: 20 }).notNull(),
		verb: varchar("verb", { length: 64 }).notNull(),
		target: text("target"),
		extra: text("extra"),
		project_id: varchar("project_id", { length: 16 }).references(
			() => project.id,
			{ onDelete: "set null" },
		),
		task_id: varchar("task_id", { length: 16 }).references(() => task.id, {
			onDelete: "set null",
		}),
		...timestamps,
	},
	(table) => [
		index("activity_workspace_created_idx").on(
			table.workspace_id,
			table.created_at,
		),
	],
);

// Per-person updates for the Notifications page and Inbox.
export const notification = pgTable(
	"notification",
	{
		id: varchar("id", { length: 16 })
			.primaryKey()
			.$defaultFn(() => generateNanoId()),
		user_id: varchar("user_id", { length: 16 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		workspace_id: varchar("workspace_id", { length: 16 })
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		actor_id: varchar("actor_id", { length: 16 }).references(() => user.id, {
			onDelete: "set null",
		}),
		// mention | assign | comment | update (the Inbox tabs)
		type: varchar("type", { length: 20 }).notNull(),
		text: text("text").notNull(),
		snippet: text("snippet"),
		project_id: varchar("project_id", { length: 16 }).references(
			() => project.id,
			{ onDelete: "set null" },
		),
		task_id: varchar("task_id", { length: 16 }).references(() => task.id, {
			onDelete: "set null",
		}),
		read_at: timestamp("read_at", {
			mode: "date",
			precision: 3,
			withTimezone: true,
		}),
		...timestamps,
	},
	(table) => [
		index("notification_user_workspace_idx").on(
			table.user_id,
			table.workspace_id,
			table.created_at,
		),
	],
);
