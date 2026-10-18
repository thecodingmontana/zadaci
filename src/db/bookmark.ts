import { sql } from "drizzle-orm";
import {
	boolean,
	doublePrecision,
	index,
	primaryKey,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { project } from "./project";
import { generateNanoId, pgTable, syncable, timestamps } from "./utils";
import { workspace } from "./workspace";

/**
 * A folder of saved links. Sharing works like notes: open to the workspace's members,
 * private to its author, or linked to a project (then it follows the project's sharing).
 */
export const bookmark_collection = pgTable(
	"bookmark_collection",
	{
		id: varchar("id", { length: 16 })
			.primaryKey()
			.$defaultFn(() => generateNanoId()),
		workspace_id: varchar("workspace_id", { length: 16 })
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 100 }).notNull(),
		/** an emoji shown before the name */
		icon: varchar("icon", { length: 16 }),
		private: boolean("private").notNull().default(false),
		project_id: varchar("project_id", { length: 16 }).references(
			() => project.id,
			{ onDelete: "set null" },
		),
		sort_order: doublePrecision("sort_order").notNull().default(0),
		created_by: varchar("created_by", { length: 16 }).notNull(),
		...syncable,
	},
	(table) => [
		index("bookmark_collection_workspace_id_idx").on(table.workspace_id),
	],
);

/** A saved link. One that's in no collection is "unsorted" and open to members. */
export const bookmark = pgTable(
	"bookmark",
	{
		id: varchar("id", { length: 16 })
			.primaryKey()
			.$defaultFn(() => generateNanoId()),
		workspace_id: varchar("workspace_id", { length: 16 })
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		url: text("url").notNull(),
		title: text("title").notNull(),
		description: text("description"),
		/** the page's preview image (an https URL on the site itself) */
		image: text("image"),
		/** the site's name, e.g. "The Verge" */
		site: varchar("site", { length: 200 }),
		/** article, document or video (see lib/link-preview) */
		kind: varchar("kind", { length: 16 }).notNull().default("article"),
		tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
		archived_at: timestamp("archived_at", {
			mode: "date",
			precision: 3,
			withTimezone: true,
		}),
		created_by: varchar("created_by", { length: 16 }).notNull(),
		...syncable,
	},
	(table) => [
		index("bookmark_workspace_created_idx").on(
			table.workspace_id,
			table.created_at,
		),
	],
);

export const bookmark_collections = pgTable(
	"bookmark_collections",
	{
		bookmark_id: varchar("bookmark_id", { length: 16 })
			.notNull()
			.references(() => bookmark.id, { onDelete: "cascade" }),
		collection_id: varchar("collection_id", { length: 16 })
			.notNull()
			.references(() => bookmark_collection.id, { onDelete: "cascade" }),
		...timestamps,
	},
	(table) => [
		primaryKey({ columns: [table.bookmark_id, table.collection_id] }),
		index("bookmark_collections_collection_idx").on(table.collection_id),
	],
);
