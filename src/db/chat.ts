import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	boolean,
	index,
	jsonb,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { project, task } from "./project";
import { team } from "./team";
import { generateNanoId, pgTable, syncable, timestamps } from "./utils";
import { workspace, workspace_members } from "./workspace";

// Team chat: workspace channels (open to every member, or private to theirs) and direct
// messages. Messages go out live over Supabase Realtime's private `chat:<channelId>` topics.
// (Zad's own conversations are separate: see ai.ts.)

export type ChatAttachment = {
	url: string;
	name: string;
	/** bytes */
	size: number;
	/** its MIME type, e.g. image/png or audio/webm */
	type: string;
	/** a voice note's length in seconds */
	seconds?: number;
};

const when = (name: string) =>
	timestamp(name, { mode: "date", precision: 3, withTimezone: true });

export const chat_channel = pgTable(
	"chat_channel",
	{
		id: varchar("id", { length: 16 })
			.primaryKey()
			.$defaultFn(() => generateNanoId()),
		workspace_id: varchar("workspace_id", { length: 16 })
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		/** "channel" or "dm" */
		kind: varchar("kind", { length: 10 }).notNull(),
		/** null for direct messages, which are named after the people in them */
		name: varchar("name", { length: 80 }),
		topic: varchar("topic", { length: 250 }),
		/** a private channel or a DM: only its members see it */
		private: boolean("private").notNull().default(false),
		created_by: varchar("created_by", { length: 16 }).references(
			() => workspace_members.id,
			{ onDelete: "set null" },
		),
		/** a channel about one project or one task (at most one of the two) */
		project_id: varchar("project_id", { length: 16 }).references(
			() => project.id,
			{ onDelete: "set null" },
		),
		task_id: varchar("task_id", { length: 16 }).references(() => task.id, {
			onDelete: "set null",
		}),
		/** a team's own channel: its members are the team's, and follow it */
		team_id: varchar("team_id", { length: 16 }).references(() => team.id, {
			onDelete: "cascade",
		}),
		last_message_at: when("last_message_at"),
		archived_at: when("archived_at"),
		...timestamps,
	},
	(t) => [
		index("chat_channel_workspace_idx").on(t.workspace_id),
		// every workspace has exactly one #general, which everyone joins
		uniqueIndex("chat_channel_general_unique")
			.on(t.workspace_id)
			.where(sql`kind = 'channel' and name = 'general'`),
		// one channel per team
		uniqueIndex("chat_channel_team_unique")
			.on(t.team_id)
			.where(sql`team_id is not null`),
	],
);

export const chat_member = pgTable(
	"chat_member",
	{
		id: varchar("id", { length: 16 })
			.primaryKey()
			.$defaultFn(() => generateNanoId()),
		channel_id: varchar("channel_id", { length: 16 })
			.notNull()
			.references(() => chat_channel.id, { onDelete: "cascade" }),
		member_id: varchar("member_id", { length: 16 })
			.notNull()
			.references(() => workspace_members.id, { onDelete: "cascade" }),
		/** messages after this are unread */
		last_read_at: when("last_read_at"),
		/** shown under Favourites in this member's chat sidebar */
		favorite: boolean("favorite").notNull().default(false),
		/** pinned to the top of this member's chat sidebar (newest pin first) */
		pinned_at: when("pinned_at"),
		...timestamps,
	},
	(t) => [
		uniqueIndex("chat_member_unique").on(t.channel_id, t.member_id),
		index("chat_member_member_idx").on(t.member_id),
	],
);

export const chat_message = pgTable(
	"chat_message",
	{
		id: varchar("id", { length: 16 })
			.primaryKey()
			.$defaultFn(() => generateNanoId()),
		channel_id: varchar("channel_id", { length: 16 })
			.notNull()
			.references(() => chat_channel.id, { onDelete: "cascade" }),
		author_id: varchar("author_id", { length: 16 }).references(
			() => workspace_members.id,
			{ onDelete: "set null" },
		),
		/** a reply in a thread: the message it answers (threads are one level deep) */
		parent_id: varchar("parent_id", { length: 16 }).references(
			(): AnyPgColumn => chat_message.id,
			{ onDelete: "cascade" },
		),
		body: text("body").notNull(),
		// emoji -> member ids who reacted (like comment reactions)
		reactions: jsonb("reactions")
			.$type<Record<string, string[]>>()
			.notNull()
			.default(sql`'{}'::jsonb`),
		edited_at: when("edited_at"),
		/** tasks, projects, notes or bookmarks shared in it: only what they are; each reader's card
		 *  is looked up with their own access */
		shares: jsonb("shares")
			.$type<{ kind: string; id: string }[]>()
			.notNull()
			.default(sql`'[]'::jsonb`),
		/** member ids picked from the @ list (the text shows @Name; this says who was meant) */
		mentions: jsonb("mentions")
			.$type<string[]>()
			.notNull()
			.default(sql`'[]'::jsonb`),
		/** files sent with it (uploaded to Cloudinary, in the channel's folder) */
		attachments: jsonb("attachments")
			.$type<ChatAttachment[]>()
			.notNull()
			.default(sql`'[]'::jsonb`),
		/** pinned to the channel's Pins */
		pinned_at: when("pinned_at"),
		pinned_by: varchar("pinned_by", { length: 16 }).references(
			() => workspace_members.id,
			{ onDelete: "set null" },
		),
		...syncable,
	},
	(t) => [
		index("chat_message_channel_idx").on(t.channel_id, t.created_at),
		index("chat_message_parent_idx").on(t.parent_id, t.created_at),
	],
);
