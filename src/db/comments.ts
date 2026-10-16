import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	index,
	jsonb,
	text,
	varchar,
} from "drizzle-orm/pg-core";
import { generateNanoId, pgTable, syncable } from "./utils";
import { workspace_members } from "./workspace";

export const comment = pgTable(
	"comment",
	{
		id: varchar("id", { length: 16 })
			.primaryKey()
			.$defaultFn(() => generateNanoId()),
		entity_type: varchar("entity_type", { length: 50 }).notNull(),
		entity_id: varchar("entity_id", { length: 16 }).notNull(),
		author_id: varchar("author_id", { length: 16 })
			.notNull()
			.references(() => workspace_members.id, { onDelete: "cascade" }),
		content: text("content").notNull(),
		parent_id: varchar("parent_id", { length: 16 }).references(
			(): AnyPgColumn => comment.id,
			{
				onDelete: "set null",
			},
		),
		// emoji -> member ids who reacted
		reactions: jsonb("reactions").notNull().default(sql`'{}'::jsonb`),
		...syncable,
	},
	(table) => [
		index("comment_entity_idx").on(table.entity_type, table.entity_id),
		index("comment_author_id_idx").on(table.author_id),
		index("comment_parent_id_idx").on(table.parent_id),
	],
);
