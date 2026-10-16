import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	doublePrecision,
	index,
	integer,
	jsonb,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import {
	PRIORITY,
	PROJECT_STATUS,
	priority_enum,
	project_status_enum,
	STATUS,
	status_enum,
} from "./enums";
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
		icon: varchar("icon", { length: 60 }),
		// sidebar order (Move up/down) and soft archive (hidden from the sidebar, restorable)
		sort_order: integer("sort_order").notNull().default(0),
		archived_at: timestamp("archived_at", {
			mode: "date",
			precision: 3,
			withTimezone: true,
		}),
		color: varchar("color", { length: 20 }),
		status: project_status_enum("status")
			.default(PROJECT_STATUS.PLANNING)
			.notNull(),
		priority: priority_enum("priority").default(PRIORITY.NONE).notNull(),
		workspace_id: varchar("workspace_id", { length: 16 })
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		team_id: varchar("team_id", { length: 16 }).references(() => team.id, {
			onDelete: "set null",
		}),
		due_date: timestamp("due_date", { mode: "date" }),
		start_date: timestamp("start_date", { mode: "date" }),
		// short code that prefixes task keys, e.g. WEB-103
		key: varchar("key", { length: 6 }).notNull().default("PRJ"),
		// last task number handed out in this project (bumped atomically per new task)
		task_seq: integer("task_seq").notNull().default(0),
		// "workspace": everyone can view and comment; "private": only people invited
		access: varchar("access", { length: 20 }).notNull().default("workspace"),
		// the project lead always has full access
		lead_id: varchar("lead_id", { length: 16 }).references(
			() => workspace_members.id,
			{ onDelete: "set null" },
		),
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
		// view | comment | edit | full; null uses the role default (see projectRight)
		permission: varchar("permission", { length: 20 }),
		...syncable,
	},
	(table) => [
		index("project_members_project_id_idx").on(table.project_id),
		// one live row per person per project
		uniqueIndex("project_members_active_idx")
			.on(table.project_id, table.member_id)
			.where(sql`${table.deleted_at} is null`),
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
		parent_task_id: varchar("parent_task_id", { length: 16 }).references(
			(): AnyPgColumn => task.id,
			{
				onDelete: "set null",
			},
		),
		due_date: timestamp("due_date", { mode: "date" }),
		start_date: timestamp("start_date", { mode: "date" }),
		// per-project counter behind the task key (WEB-103)
		number: integer("number").notNull().default(0),
		// fractional so drag and drop can drop between two tasks without renumbering
		sort_order: doublePrecision("sort_order").notNull().default(0),
		// fixed label ids from src/lib/tasks.ts LABELS
		labels: text("labels").array().notNull().default(sql`'{}'::text[]`),
		estimate: varchar("estimate", { length: 20 }),
		// Daily | Weekdays | Weekly | Every 2 weeks | Monthly
		recur: varchar("recur", { length: 20 }),
		completed_at: timestamp("completed_at", {
			mode: "date",
			withTimezone: true,
		}),
		archived_at: timestamp("archived_at", { mode: "date", withTimezone: true }),
		...syncable,
	},
	(table) => [
		index("tasks_project_id_idx").on(table.project_id),
		index("tasks_parent_task_id_idx").on(table.parent_task_id),
	],
);

// "Blocked by": a task waits on the tasks it depends on.
export const task_dependency = pgTable(
	"task_dependency",
	{
		id: varchar("id", { length: 16 })
			.primaryKey()
			.$defaultFn(() => generateNanoId()),
		task_id: varchar("task_id", { length: 16 })
			.notNull()
			.references(() => task.id, { onDelete: "cascade" }),
		depends_on_id: varchar("depends_on_id", { length: 16 })
			.notNull()
			.references(() => task.id, { onDelete: "cascade" }),
		...timestamps,
	},
	(table) => [
		uniqueIndex("task_dependency_pair_idx").on(
			table.task_id,
			table.depends_on_id,
		),
		index("task_dependency_depends_on_idx").on(table.depends_on_id),
	],
);

// Files uploaded to Cloudinary: on a project's Files tab, and optionally on one of its tasks.
export const task_attachment = pgTable(
	"task_attachment",
	{
		id: varchar("id", { length: 16 })
			.primaryKey()
			.$defaultFn(() => generateNanoId()),
		project_id: varchar("project_id", { length: 16 })
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		task_id: varchar("task_id", { length: 16 }).references(() => task.id, {
			onDelete: "cascade",
		}),
		name: varchar("name", { length: 255 }).notNull(),
		url: text("url").notNull(),
		mime: varchar("mime", { length: 120 }),
		size: integer("size").notNull().default(0),
		uploaded_by: varchar("uploaded_by", { length: 16 }).references(
			() => workspace_members.id,
			{ onDelete: "set null" },
		),
		...syncable,
	},
	(table) => [
		index("task_attachment_task_id_idx").on(table.task_id),
		index("task_attachment_project_id_idx").on(table.project_id),
	],
);

// Saved filters shown as extra tabs on a project (reference savedViews).
export const saved_view = pgTable(
	"saved_view",
	{
		id: varchar("id", { length: 16 })
			.primaryKey()
			.$defaultFn(() => generateNanoId()),
		project_id: varchar("project_id", { length: 16 })
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 100 }).notNull(),
		// list | board | table
		type: varchar("type", { length: 20 }).notNull(),
		filters: jsonb("filters").notNull().default(sql`'[]'::jsonb`),
		created_by: varchar("created_by", { length: 16 }).references(
			() => workspace_members.id,
			{ onDelete: "set null" },
		),
		...syncable,
	},
	(table) => [index("saved_view_project_id_idx").on(table.project_id)],
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

// Dated checkpoints shown on the project overview and the timeline.
export const project_milestone = pgTable(
	"project_milestone",
	{
		id: varchar("id", { length: 16 })
			.primaryKey()
			.$defaultFn(() => generateNanoId()),
		project_id: varchar("project_id", { length: 16 })
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 255 }).notNull(),
		date: timestamp("date", { mode: "date" }).notNull(),
		...syncable,
	},
	(table) => [index("project_milestone_project_id_idx").on(table.project_id)],
);
