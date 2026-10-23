import {
	index,
	integer,
	jsonb,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { user } from "./user";
import { generateNanoId, pgTable, timestamps } from "./utils";
import { workspace } from "./workspace";

// The assistant's saved chats. A conversation is one chat thread (its id is the thread id the
// browser picks); messages keep the standard model message shape so any model can continue them.

export const ai_conversation = pgTable(
	"ai_conversation",
	{
		id: varchar("id", { length: 64 }).primaryKey(),
		user_id: varchar("user_id", { length: 16 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		workspace_id: varchar("workspace_id", { length: 16 })
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		title: text("title").notNull().default("New chat"),
		...timestamps,
	},
	(table) => [
		index("ai_conversation_user_idx").on(
			table.user_id,
			table.workspace_id,
			table.updated_at,
		),
	],
);

export const ai_message = pgTable(
	"ai_message",
	{
		id: varchar("id", { length: 16 })
			.primaryKey()
			.$defaultFn(() => generateNanoId()),
		conversation_id: varchar("conversation_id", { length: 64 })
			.notNull()
			.references(() => ai_conversation.id, { onDelete: "cascade" }),
		user_id: varchar("user_id", { length: 16 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		position: integer("position").notNull(),
		// user | assistant | tool | system
		role: varchar("role", { length: 16 }).notNull(),
		// text, or content parts, as the model message has them
		content: jsonb("content"),
		tool_calls: jsonb("tool_calls"),
		tool_call_id: varchar("tool_call_id", { length: 120 }),
		// which model wrote an assistant message
		model: varchar("model", { length: 160 }),
		// anything else the message carries (name, metadata), so it round-trips unchanged
		extra: jsonb("extra"),
		created_at: timestamp("created_at", {
			mode: "date",
			precision: 3,
			withTimezone: true,
		})
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("ai_message_conversation_idx").on(
			table.conversation_id,
			table.position,
		),
		index("ai_message_user_idx").on(table.user_id),
	],
);
