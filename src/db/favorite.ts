import { index, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { user } from "./user";
import { generateNanoId, pgTable, timestamps } from "./utils";
import { workspace } from "./workspace";

// Per-user stars on projects (and later tasks), shown in the sidebar and on the Favorites page.
export const favorite = pgTable(
	"favorite",
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
		entity_type: varchar("entity_type", { length: 20 }).notNull(),
		entity_id: varchar("entity_id", { length: 16 }).notNull(),
		...timestamps,
	},
	(table) => [
		uniqueIndex("favorite_user_entity_idx").on(
			table.user_id,
			table.entity_type,
			table.entity_id,
		),
		index("favorite_workspace_idx").on(table.workspace_id),
	],
);
