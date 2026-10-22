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
		// a task's or project's history (task drawer, project activity)
		index("activity_task_created_idx").on(table.task_id, table.created_at),
		index("activity_project_created_idx").on(
			table.project_id,
			table.created_at,
		),
		// foreign keys that are set to null on delete: without these each delete scans the table
		index("activity_actor_id_idx").on(table.actor_id),
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
		index("notification_actor_id_idx").on(table.actor_id),
		index("notification_task_id_idx").on(table.task_id),
		index("notification_project_id_idx").on(table.project_id),
	],
);

// One row per browser or phone that turned on push notifications (Settings → Push).
export const push_subscription = pgTable(
	"push_subscription",
	{
		id: varchar("id", { length: 16 })
			.primaryKey()
			.$defaultFn(() => generateNanoId()),
		user_id: varchar("user_id", { length: 16 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		endpoint: text("endpoint").notNull().unique(),
		p256dh: text("p256dh").notNull(),
		auth: text("auth").notNull(),
		...timestamps,
	},
	(table) => [index("push_subscription_user_idx").on(table.user_id)],
);
