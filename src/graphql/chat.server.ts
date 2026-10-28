import {
	and,
	count,
	desc,
	eq,
	gt,
	inArray,
	isNull,
	lt,
	ne,
	or,
	sql,
} from "drizzle-orm";
import { db, tables } from "#/db";
import { isEmoji } from "#/lib/emoji";
import { announceChat } from "#/lib/realtime.server";
import { notify } from "./activity.server";
import { badInput, type GraphQLContext } from "./schema.server";
import { requireWorkspace } from "./settings.server";

// Team chat: open and private channels plus direct messages, saved here and sent live over
// Realtime (lib/realtime.server announceChat). Every read and write checks the person can see
// the channel: an open channel is the whole workspace's, a private one or a DM only its members'.

const MAX_BODY = 4000;
const PER_MINUTE = 30;
const PAGE = 50;
const MAX_REACTIONS = 20;

type Workspace = Awaited<ReturnType<typeof requireWorkspace>>["workspace"];
type Channel = typeof tables.chat_channel.$inferSelect;
type Message = typeof tables.chat_message.$inferSelect;
type Person = { id: string; name: string; image: string | null };

export const chatTypeDefs = /* GraphQL */ `
	type ChatPerson {
		id: ID!
		name: String!
		image: String
	}

	type ChatChannel {
		id: ID!
		kind: String!
		"a DM has none: it's named after its people"
		name: String
		topic: String
		private: Boolean!
		people: [ChatPerson!]!
		unread: Int!
		lastMessageAt: String
	}

	type ChatMessage {
		id: ID!
		channelId: ID!
		author: ChatPerson
		body: String!
		reactions: [Reaction!]!
		editedAt: String
		mine: Boolean!
		createdAt: String!
	}

	extend type Workspace {
		chatChannels: [ChatChannel!]!
	}

	extend type Query {
		"newest page first; before: an ISO time to load older messages"
		chatMessages(slug: String!, channelId: ID!, before: String): [ChatMessage!]!
	}

	extend type Mutation {
		createChatChannel(
			slug: String!
			name: String!
			topic: String
			private: Boolean
			memberIds: [ID!]
		): ChatChannel!
		"finds or starts a DM with these members (and you)"
		openChatDm(slug: String!, memberIds: [ID!]!): ChatChannel!
		sendChatMessage(slug: String!, channelId: ID!, body: String!): ChatMessage!
		editChatMessage(slug: String!, id: ID!, body: String!): ChatMessage!
		deleteChatMessage(slug: String!, id: ID!): Boolean!
		reactToChatMessage(slug: String!, id: ID!, emoji: String!): ChatMessage!
		markChatRead(slug: String!, channelId: ID!): Boolean!
	}
`;

/** Channels this member may see: open ones, and private ones and DMs they belong to. */
const visible = (ws: Workspace) =>
	and(
		eq(tables.chat_channel.workspace_id, ws.id),
		isNull(tables.chat_channel.archived_at),
		or(
			eq(tables.chat_channel.private, false),
			sql`exists (select 1 from ${tables.chat_member} where ${tables.chat_member.channel_id} = ${tables.chat_channel.id} and ${tables.chat_member.member_id} = ${ws.memberId ?? ""})`,
		),
	);

async function requireChannel(ctx: GraphQLContext, slug: string, id: string) {
	const { user, workspace } = await requireWorkspace(ctx, slug);
	const [channel] = await db
		.select()
		.from(tables.chat_channel)
		.where(and(eq(tables.chat_channel.id, id), visible(workspace)));
	if (!channel) badInput("Conversation not found");
	return { user, workspace, channel };
}

/** Joins the member to the channel (an open one on first visit), optionally marking it read. */
const join = (channelId: string, memberId: string, readNow = false) =>
	db
		.insert(tables.chat_member)
		.values({
			channel_id: channelId,
			member_id: memberId,
			last_read_at: readNow ? new Date() : null,
		})
		.onConflictDoUpdate({
			target: [tables.chat_member.channel_id, tables.chat_member.member_id],
			set: readNow ? { last_read_at: new Date() } : { updated_at: sql`now()` },
		});

async function people(channelIds: string[]) {
	const by = new Map<string, Person[]>();
	if (!channelIds.length) return by;
	const rows = await db
		.select({
			channelId: tables.chat_member.channel_id,
			id: tables.workspace_members.id,
			name: tables.user.name,
			image: tables.user.image,
		})
		.from(tables.chat_member)
		.innerJoin(
			tables.workspace_members,
			eq(tables.workspace_members.id, tables.chat_member.member_id),
		)
		.innerJoin(
			tables.user,
			eq(tables.user.id, tables.workspace_members.user_id),
		)
		.where(
			and(
				inArray(tables.chat_member.channel_id, channelIds),
				isNull(tables.workspace_members.deleted_at),
			),
		);
	for (const { channelId, ...p } of rows)
		by.set(channelId, [...(by.get(channelId) ?? []), p]);
	return by;
}

async function channelShape(channels: Channel[], ws: Workspace) {
	const ids = channels.map((c) => c.id);
	const me = ws.memberId ?? "";
	const [members, unread] = await Promise.all([
		people(ids),
		ids.length
			? db
					.select({ channelId: tables.chat_message.channel_id, n: count() })
					.from(tables.chat_message)
					.innerJoin(
						tables.chat_member,
						and(
							eq(tables.chat_member.channel_id, tables.chat_message.channel_id),
							eq(tables.chat_member.member_id, me),
						),
					)
					.where(
						and(
							inArray(tables.chat_message.channel_id, ids),
							isNull(tables.chat_message.deleted_at),
							ne(tables.chat_message.author_id, me),
							gt(
								tables.chat_message.created_at,
								sql`coalesce(${tables.chat_member.last_read_at}, ${tables.chat_member.created_at})`,
							),
						),
					)
					.groupBy(tables.chat_message.channel_id)
			: [],
	]);
	const unreadBy = new Map(unread.map((u) => [u.channelId, Number(u.n)]));
	return channels.map((c) => ({
		id: c.id,
		kind: c.kind,
		name: c.name,
		topic: c.topic,
		private: c.private,
		people: members.get(c.id) ?? [],
		unread: unreadBy.get(c.id) ?? 0,
		lastMessageAt: c.last_message_at?.toISOString() ?? null,
	}));
}

async function messageShape(rows: Message[], ws: Workspace) {
	const ids = [
		...new Set(
			rows
				.flatMap((m) => [m.author_id, ...Object.values(m.reactions).flat()])
				.filter((x): x is string => !!x),
		),
	];
	const authors = ids.length
		? await db
				.select({
					id: tables.workspace_members.id,
					name: tables.user.name,
					image: tables.user.image,
				})
				.from(tables.workspace_members)
				.innerJoin(
					tables.user,
					eq(tables.user.id, tables.workspace_members.user_id),
				)
				.where(inArray(tables.workspace_members.id, ids))
		: [];
	const byId = new Map(authors.map((a) => [a.id, a]));
	return rows.map((m) => ({
		id: m.id,
		channelId: m.channel_id,
		author: (m.author_id && byId.get(m.author_id)) || null,
		body: m.body,
		reactions: Object.entries(m.reactions)
			.filter(([, who]) => who.length)
			.map(([emoji, who]) => ({
				emoji,
				count: who.length,
				mine: who.includes(ws.memberId ?? ""),
				names: who.map((id) => byId.get(id)?.name ?? "Someone"),
			})),
		editedAt: m.edited_at?.toISOString() ?? null,
		mine: m.author_id === ws.memberId,
		createdAt: m.created_at.toISOString(),
	}));
}

/** A message in a channel the person can see; `ownOnly` for edits and deletes. */
async function requireMessage(
	ctx: GraphQLContext,
	slug: string,
	id: string,
	ownOnly: boolean,
) {
	const [message] = await db
		.select()
		.from(tables.chat_message)
		.where(
			and(
				eq(tables.chat_message.id, id),
				isNull(tables.chat_message.deleted_at),
			),
		);
	if (!message) badInput("Message not found");
	const { workspace, channel } = await requireChannel(
		ctx,
		slug,
		message.channel_id,
	);
	if (ownOnly && message.author_id !== workspace.memberId)
		badInput("You can only change your own messages");
	return { workspace, channel, message };
}

const body = (value: string) => {
	const text = value.trim();
	if (!text) badInput("Write a message first");
	if (text.length > MAX_BODY)
		badInput(`Messages can be up to ${MAX_BODY} characters`);
	return text;
};

/** Mentioned people, and the rest of a DM, hear about a message. */
async function notifyChat(
	ws: Workspace,
	actorId: string,
	channel: Channel,
	text: string,
) {
	const members = await db
		.select({
			userId: tables.workspace_members.user_id,
			name: tables.user.name,
		})
		.from(tables.workspace_members)
		.innerJoin(
			tables.user,
			eq(tables.user.id, tables.workspace_members.user_id),
		)
		.where(
			and(
				eq(tables.workspace_members.workspace_id, ws.id),
				isNull(tables.workspace_members.deleted_at),
				// only people who can see the channel: the snippet quotes the message
				channel.private
					? inArray(
							tables.workspace_members.id,
							db
								.select({ id: tables.chat_member.member_id })
								.from(tables.chat_member)
								.where(eq(tables.chat_member.channel_id, channel.id)),
						)
					: undefined,
			),
		);
	const others = members.filter((m) => m.userId !== actorId);
	const mentioned = others.filter((m) => text.includes(`@${m.name}`));
	let dmTo: typeof others = [];
	if (channel.kind === "dm") {
		// shortcut: a DM notifies once per 10-minute burst per sender, so a chat isn't a stream of emails
		const [recent] = await db
			.select({ n: count() })
			.from(tables.chat_message)
			.where(
				and(
					eq(tables.chat_message.channel_id, channel.id),
					eq(tables.chat_message.author_id, ws.memberId ?? ""),
					gt(tables.chat_message.created_at, new Date(Date.now() - 600_000)),
				),
			);
		if ((recent?.n ?? 0) <= 1)
			dmTo = others.filter((m) => !mentioned.includes(m));
	}
	const where = channel.kind === "dm" ? "a message" : `#${channel.name}`;
	const base = {
		workspace_id: ws.id,
		actor_id: actorId,
		type: "mention",
		snippet: text.slice(0, 200),
	};
	await notify(db, [
		...mentioned.map((m) => ({
			...base,
			user_id: m.userId,
			text: `mentioned you in ${where}`,
		})),
		...dmTo.map((m) => ({
			...base,
			user_id: m.userId,
			text: "sent you a message",
		})),
	]);
}

/** The ids that really are members of this workspace (anything else is dropped). */
async function sameWorkspace(ws: Workspace, ids: string[]) {
	const wanted = [...new Set(ids.filter(Boolean))].slice(0, 50);
	if (!wanted.length) return [];
	const rows = await db
		.select({ id: tables.workspace_members.id })
		.from(tables.workspace_members)
		.where(
			and(
				eq(tables.workspace_members.workspace_id, ws.id),
				inArray(tables.workspace_members.id, wanted),
				isNull(tables.workspace_members.deleted_at),
			),
		);
	return rows.map((r) => r.id);
}

export const chatResolvers = {
	Workspace: {
		chatChannels: async (w: Workspace) => {
			const rows = await db
				.select()
				.from(tables.chat_channel)
				.where(visible(w))
				.orderBy(desc(tables.chat_channel.last_message_at));
			return channelShape(rows, w);
		},
	},
	Query: {
		chatMessages: async (
			_: unknown,
			args: { slug: string; channelId: string; before?: string | null },
			ctx: GraphQLContext,
		) => {
			const { workspace, channel } = await requireChannel(
				ctx,
				args.slug,
				args.channelId,
			);
			const before = args.before ? new Date(args.before) : null;
			if (before && Number.isNaN(before.getTime())) badInput("Bad position");
			const rows = await db
				.select()
				.from(tables.chat_message)
				.where(
					and(
						eq(tables.chat_message.channel_id, channel.id),
						isNull(tables.chat_message.deleted_at),
						before ? lt(tables.chat_message.created_at, before) : undefined,
					),
				)
				.orderBy(desc(tables.chat_message.created_at))
				.limit(PAGE);
			return messageShape(rows.reverse(), workspace);
		},
	},
	Mutation: {
		createChatChannel: async (
			_: unknown,
			args: {
				slug: string;
				name: string;
				topic?: string | null;
				private?: boolean | null;
				memberIds?: string[] | null;
			},
			ctx: GraphQLContext,
		) => {
			const { workspace } = await requireWorkspace(ctx, args.slug);
			const name = args.name
				.trim()
				.toLowerCase()
				.replace(/\s+/g, "-")
				.replace(/[^a-z0-9_-]/g, "")
				.slice(0, 80);
			if (!name) badInput("Give the channel a name");
			const [channel] = await db
				.insert(tables.chat_channel)
				.values({
					workspace_id: workspace.id,
					kind: "channel",
					name,
					topic: args.topic?.trim().slice(0, 250) || null,
					private: !!args.private,
					created_by: workspace.memberId,
				})
				.returning();
			const ids = await sameWorkspace(workspace, [
				workspace.memberId ?? "",
				...(args.memberIds ?? []),
			]);
			for (const id of ids)
				await join(channel.id, id, id === workspace.memberId);
			return (await channelShape([channel], workspace))[0];
		},
		openChatDm: async (
			_: unknown,
			args: { slug: string; memberIds: string[] },
			ctx: GraphQLContext,
		) => {
			const { workspace } = await requireWorkspace(ctx, args.slug);
			const ids = await sameWorkspace(workspace, [
				workspace.memberId ?? "",
				...args.memberIds,
			]);
			if (ids.length < 2 || ids.length > 9)
				badInput("Pick one to eight people");
			const key = [...ids].sort().join(",");
			// the same people always land in the same DM
			const [existing] = await db
				.select()
				.from(tables.chat_channel)
				.where(
					and(
						eq(tables.chat_channel.workspace_id, workspace.id),
						eq(tables.chat_channel.kind, "dm"),
						sql`(select string_agg(${tables.chat_member.member_id}, ',' order by ${tables.chat_member.member_id}) from ${tables.chat_member} where ${tables.chat_member.channel_id} = ${tables.chat_channel.id}) = ${key}`,
					),
				);
			const channel =
				existing ??
				(
					await db
						.insert(tables.chat_channel)
						.values({
							workspace_id: workspace.id,
							kind: "dm",
							private: true,
							created_by: workspace.memberId,
						})
						.returning()
				)[0];
			if (!existing) for (const id of ids) await join(channel.id, id);
			return (await channelShape([channel], workspace))[0];
		},
		sendChatMessage: async (
			_: unknown,
			args: { slug: string; channelId: string; body: string },
			ctx: GraphQLContext,
		) => {
			const { user, workspace, channel } = await requireChannel(
				ctx,
				args.slug,
				args.channelId,
			);
			const text = body(args.body);
			const [recent] = await db
				.select({ n: count() })
				.from(tables.chat_message)
				.where(
					and(
						eq(tables.chat_message.author_id, workspace.memberId ?? ""),
						gt(tables.chat_message.created_at, new Date(Date.now() - 60_000)),
					),
				);
			if ((recent?.n ?? 0) >= PER_MINUTE)
				badInput("You're sending messages very fast. Wait a moment.");
			const [message] = await db
				.insert(tables.chat_message)
				.values({
					channel_id: channel.id,
					author_id: workspace.memberId,
					body: text,
				})
				.returning();
			await db
				.update(tables.chat_channel)
				.set({ last_message_at: message.created_at })
				.where(eq(tables.chat_channel.id, channel.id));
			await join(channel.id, workspace.memberId ?? "", true);
			const [shaped] = await messageShape([message], workspace);
			announceChat(
				workspace.id,
				channel.id,
				{ type: "new", id: message.id },
				ctx.tab,
			);
			await notifyChat(workspace, user.id, channel, text);
			return shaped;
		},
		editChatMessage: async (
			_: unknown,
			args: { slug: string; id: string; body: string },
			ctx: GraphQLContext,
		) => {
			const { workspace, channel, message } = await requireMessage(
				ctx,
				args.slug,
				args.id,
				true,
			);
			const [updated] = await db
				.update(tables.chat_message)
				.set({ body: body(args.body), edited_at: new Date() })
				.where(eq(tables.chat_message.id, message.id))
				.returning();
			announceChat(
				workspace.id,
				channel.id,
				{ type: "edit", id: message.id },
				ctx.tab,
			);
			return (await messageShape([updated], workspace))[0];
		},
		deleteChatMessage: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const { workspace, channel, message } = await requireMessage(
				ctx,
				args.slug,
				args.id,
				true,
			);
			await db
				.update(tables.chat_message)
				.set({ deleted_at: new Date() })
				.where(eq(tables.chat_message.id, message.id));
			announceChat(
				workspace.id,
				channel.id,
				{ type: "delete", id: message.id },
				ctx.tab,
			);
			return true;
		},
		reactToChatMessage: async (
			_: unknown,
			args: { slug: string; id: string; emoji: string },
			ctx: GraphQLContext,
		) => {
			if (!isEmoji(args.emoji)) badInput("Pick an emoji");
			const { workspace, channel, message } = await requireMessage(
				ctx,
				args.slug,
				args.id,
				false,
			);
			const used = Object.entries(message.reactions).filter(
				([, who]) => who.length > 0,
			);
			if (!used.some(([e]) => e === args.emoji) && used.length >= MAX_REACTIONS)
				badInput(
					`A message can have up to ${MAX_REACTIONS} different reactions`,
				);
			const me = workspace.memberId ?? "";
			const list = sql`coalesce(${tables.chat_message.reactions} -> ${args.emoji}::text, '[]'::jsonb)`;
			// toggled in one statement, so two people reacting at once both count
			const [updated] = await db
				.update(tables.chat_message)
				.set({
					reactions: sql`jsonb_set(${tables.chat_message.reactions}, array[${args.emoji}::text], case when ${list} ? ${me}::text then ${list} - ${me}::text else ${list} || to_jsonb(${me}::text) end)`,
				})
				.where(eq(tables.chat_message.id, message.id))
				.returning();
			announceChat(
				workspace.id,
				channel.id,
				{ type: "edit", id: message.id },
				ctx.tab,
			);
			return (await messageShape([updated], workspace))[0];
		},
		markChatRead: async (
			_: unknown,
			args: { slug: string; channelId: string },
			ctx: GraphQLContext,
		) => {
			const { workspace, channel } = await requireChannel(
				ctx,
				args.slug,
				args.channelId,
			);
			await join(channel.id, workspace.memberId ?? "", true);
			return true;
		},
	},
};
