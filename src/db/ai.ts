import {
	boolean,
	index,
	integer,
	jsonb,
	primaryKey,
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

// Free models the assistant can rotate between: their rank from the last discovery, and when
// one fails, how long it's skipped. The row with id ACCOUNT_ROW is the account-wide free limit.
export const ai_model = pgTable("ai_model", {
	id: varchar("id", { length: 160 }).primaryKey(),
	// 0 is best; null when it's no longer in the discovered list
	rank: integer("rank"),
	context: integer("context"),
	ranked_at: timestamp("ranked_at", { mode: "date", withTimezone: true }),
	cooldown_until: timestamp("cooldown_until", {
		mode: "date",
		withTimezone: true,
	}),
	last_error: text("last_error"),
	failures: integer("failures").notNull().default(0),
	successes: integer("successes").notNull().default(0),
	last_ms: integer("last_ms"),
	updated_at: timestamp("updated_at", { mode: "date", withTimezone: true })
		.defaultNow()
		.notNull(),
});

// How many messages each person sent the assistant per day (their own calendar day), for the
// daily limit (AI_DAILY_LIMIT).
export const ai_usage = pgTable(
	"ai_usage",
	{
		user_id: varchar("user_id", { length: 16 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		day: varchar("day", { length: 10 }).notNull(),
		count: integer("count").notNull().default(0),
	},
	(table) => [primaryKey({ columns: [table.user_id, table.day] })],
);

// People's own AI keys (bring your own key), one per provider, encrypted with a server secret
// bound to the person and provider. The browser only ever sees a key's last characters (hint).
export const ai_user_key = pgTable(
	"ai_user_key",
	{
		user_id: varchar("user_id", { length: 16 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// openrouter | anthropic | openai | gemini
		provider: varchar("provider", { length: 24 }).notNull(),
		cipher: text("cipher").notNull(),
		hint: varchar("hint", { length: 8 }).notNull(),
		// the model to use with this key ("" = the provider's default)
		model: varchar("model", { length: 120 }).notNull().default(""),
		// the key the assistant uses now (one per person)
		active: boolean("active").notNull().default(false),
		...timestamps,
	},
	(table) => [primaryKey({ columns: [table.user_id, table.provider] })],
);
