import {
	type AnyPgColumn,
	boolean,
	doublePrecision,
	index,
	jsonb,
	text,
	varchar,
} from "drizzle-orm/pg-core";
import { project } from "./project";
import { generateNanoId, pgTable, syncable } from "./utils";
import { workspace } from "./workspace";

/**
 * A page, Notion style: any note can hold sub-pages, so the sidebar is a tree and
 * "grouping" is just nesting. Deleting a page takes its sub-pages with it.
 */
export const note = pgTable(
	"note",
	{
		id: varchar("id", { length: 16 })
			.primaryKey()
			.$defaultFn(() => generateNanoId()),
		workspace_id: varchar("workspace_id", { length: 16 })
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		parent_id: varchar("parent_id", { length: 16 }).references(
			(): AnyPgColumn => note.id,
			{ onDelete: "cascade" },
		),
		/** order among siblings; a fraction so a page can drop between two others */
		sort_order: doublePrecision("sort_order").notNull().default(0),
		/** only its author sees a private page (and the pages inside it) */
		private: boolean("private").notNull().default(false),
		/** an emoji shown before the title */
		icon: varchar("icon", { length: 16 }),
		// a linked note follows the project's sharing; unlinked notes are for members
		project_id: varchar("project_id", { length: 16 }).references(
			() => project.id,
			{ onDelete: "set null" },
		),
		title: text("title").notNull(),
		/** the editor document (Tiptap JSON) */
		doc: jsonb("doc"),
		/** plain text of the document, for search and previews */
		content: text("content"),
		created_by: varchar("created_by", { length: 16 }).notNull(),
		updated_by: varchar("updated_by", { length: 16 }),
		...syncable,
	},
	(table) => [
		index("note_workspace_id_idx").on(table.workspace_id),
		index("note_parent_id_idx").on(table.parent_id),
		index("note_project_id_idx").on(table.project_id),
	],
);
