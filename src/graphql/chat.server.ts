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
	sql,
} from "drizzle-orm";
import { db, tables } from "#/db";
import type { ChatAttachment } from "#/db/chat";
import { generateNanoId } from "#/db/utils";
import { isEmoji } from "#/lib/emoji";
import { isUploadUrl } from "#/lib/files";
import { can } from "#/lib/permissions";
import { announceChat } from "#/lib/realtime.server";
import { notify } from "./activity.server";
import { findEmbed } from "./notes.server";
import { requireProject } from "./projects.server";
import { badInput, type GraphQLContext, projectScope } from "./schema.server";
import {
	cloudinary,
	requireWorkspace,
	signCloudinary,
} from "./settings.server";
import { checkUploadedSize } from "./task-extras.server";
import { requireTask } from "./tasks.server";

// Team chat: open and private channels plus direct messages, saved here and sent live over
// Realtime (lib/realtime.server announceChat). Every read and write checks the person can see
// the channel: an open channel is the whole workspace's, a private one or a DM only its members'.

const MAX_BODY = 4000;
const PER_MINUTE = 30;
const PAGE = 50;
const MAX_REACTIONS = 20;
const MAX_FILES = 10;

/** Where a channel's files go in Cloudinary (and the only place a message's files may come from). */
const chatFolder = (channelId: string) => `zadaci/chat/${channelId}`;

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

	"the project or task a channel is about"
	type ChatLink {
		kind: String!
		id: ID!
		title: String!
	}

	type ChatChannel {
		id: ID!
		kind: String!
		"the workspace's #general, which everyone is in"
		general: Boolean!
		"a DM has none: it's named after its people"
		name: String
		topic: String
		private: Boolean!
		people: [ChatPerson!]!
		unread: Int!
		lastMessageAt: String
		creator: ChatPerson
		createdAt: String!
		"null when there's none, or you can't see that project"
		link: ChatLink
		"a team's own channel: its people are the team's"
		teamId: ID
		"in your Favourites"
		favorite: Boolean!
		"a project's or task's own chat: whoever can see the project is in it"
		followsProject: Boolean!
		"when you pinned it to the top of your chat sidebar"
		pinnedAt: String
		"you made it, or you're an admin (never #general, a team's channel or a DM)"
		canDelete: Boolean!
	}

	type ChatAttachment {
		url: String!
		name: String!
		size: Int!
		type: String!
		"a voice note's length"
		seconds: Int
	}

	type ChatShare {
		kind: String!
		id: ID!
	}

	input ChatShareInput {
		kind: String!
		id: ID!
	}

	input ChatAttachmentInput {
		url: String!
		name: String!
		size: Int!
		type: String!
		seconds: Int
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
		"a reply in a thread: the message it answers"
		parentId: ID
		attachments: [ChatAttachment!]!
		"tasks, projects, notes or bookmarks shared in it (look each up with noteEmbed)"
		shares: [ChatShare!]!
		"members picked from the @ list"
		mentions: [ID!]!
		mentionsMe: Boolean!
		replyCount: Int!
		lastReplyAt: String
		pinned: Boolean!
	}

	extend type Workspace {
		chatChannels: [ChatChannel!]!
	}

	extend type Query {
		"newest page first; before: an ISO time to load older messages. parentId: that thread's replies"
		chatMessages(
			slug: String!
			channelId: ID!
			before: String
			parentId: ID
		): [ChatMessage!]!
		chatPins(slug: String!, channelId: ID!): [ChatMessage!]!
	}

	extend type Mutation {
		createChatChannel(
			slug: String!
			name: String!
			topic: String
			private: Boolean
			memberIds: [ID!]
			"link it to one project or one task"
			projectId: ID
			taskId: ID
		): ChatChannel!
		"finds or starts a DM with these members and you (none: notes to yourself)"
		openChatDm(slug: String!, memberIds: [ID!]!): ChatChannel!
		"parentId: reply in that message's thread"
		sendChatMessage(
			slug: String!
			channelId: ID!
			body: String!
			parentId: ID
			"files uploaded with chatUpload"
			attachments: [ChatAttachmentInput!]
			"members picked from the @ list (their @Name must be in the text)"
			mentionIds: [ID!]
			"tasks, projects, notes or bookmarks to share (you must be able to see each)"
			shares: [ChatShareInput!]
		): ChatMessage!
		"a signed slot to upload a file into this conversation (file: anything but a picture)"
		chatUpload(slug: String!, channelId: ID!, file: Boolean): CloudinaryUpload!
		"a conversation has one pinned message: pinning another replaces it"
		pinChatMessage(slug: String!, id: ID!, pinned: Boolean!): ChatMessage!
		deleteChatChannel(slug: String!, channelId: ID!): Boolean!
		"a project's or task's own chat: found, or started (named after it) if it has none yet"
		openChatFor(slug: String!, kind: String!, id: ID!): ChatChannel!
		"pin a conversation to the top of your own chat sidebar"
		pinChatChannel(slug: String!, channelId: ID!, pinned: Boolean!): Boolean!
		favoriteChatChannel(
			slug: String!
			channelId: ID!
			favorite: Boolean!
		): Boolean!
		editChatMessage(slug: String!, id: ID!, body: String!): ChatMessage!
		deleteChatMessage(slug: String!, id: ID!): Boolean!
		reactToChatMessage(slug: String!, id: ID!, emoji: String!): ChatMessage!
		markChatRead(slug: String!, channelId: ID!): Boolean!
	}
`;

/** Is this member on the channel's team now (a team channel follows the team, not chat_member). */
const onTeam = (memberId: string) =>
	sql`exists (select 1 from ${tables.team_members} join ${tables.team} on ${tables.team.id} = ${tables.team_members.team_id} and ${tables.team.deleted_at} is null where ${tables.team_members.team_id} = ${tables.chat_channel.team_id} and ${tables.team_members.member_id} = ${memberId} and ${tables.team_members.deleted_at} is null)`;

/** A project's (or task's) own chat: this member can see its project, the way the app decides. */
const seesProject = (ws: Workspace) =>
	db
		.select({ id: tables.project.id })
		.from(tables.project)
		.where(
			and(
				eq(tables.project.id, tables.chat_channel.project_id),
				isNull(tables.project.deleted_at),
				projectScope(ws),
			),
		);

/** Channels this member may see: a team's while on the team, open ones, and private ones and
 *  DMs they belong to. (The same rule guards Realtime: zadaci_private.can_join.) */
const visible = (ws: Workspace) =>
	and(
		eq(tables.chat_channel.workspace_id, ws.id),
		isNull(tables.chat_channel.archived_at),
		sql`case
			when ${tables.chat_channel.team_id} is not null then ${onTeam(ws.memberId ?? "")}
			when ${tables.chat_channel.follows_project} then exists (${seesProject(ws)})
			when not ${tables.chat_channel.private} then true
			else exists (select 1 from ${tables.chat_member} where ${tables.chat_member.channel_id} = ${tables.chat_channel.id} and ${tables.chat_member.member_id} = ${ws.memberId ?? ""})
		end`,
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

/** Team channels: the team's name and its current members, by channel id. */
async function teamsOf(channels: Channel[]) {
	const byTeam = new Map(
		channels.flatMap((c) => (c.team_id ? [[c.team_id, c.id] as const] : [])),
	);
	const by = new Map<string, { name: string; people: Person[] }>();
	if (!byTeam.size) return by;
	const teamIds = [...byTeam.keys()];
	const [teams, rows] = await Promise.all([
		db
			.select({ id: tables.team.id, name: tables.team.name })
			.from(tables.team)
			.where(inArray(tables.team.id, teamIds)),
		db
			.select({
				teamId: tables.team_members.team_id,
				id: tables.workspace_members.id,
				name: tables.user.name,
				image: tables.user.image,
			})
			.from(tables.team_members)
			.innerJoin(
				tables.workspace_members,
				eq(tables.workspace_members.id, tables.team_members.member_id),
			)
			.innerJoin(
				tables.user,
				eq(tables.user.id, tables.workspace_members.user_id),
			)
			.where(
				and(
					inArray(tables.team_members.team_id, teamIds),
					isNull(tables.team_members.deleted_at),
					isNull(tables.workspace_members.deleted_at),
				),
			),
	]);
	for (const t of teams) {
		const channelId = byTeam.get(t.id);
		if (channelId) by.set(channelId, { name: t.name, people: [] });
	}
	for (const { teamId, ...p } of rows)
		by.get(byTeam.get(teamId) ?? "")?.people.push(p);
	return by;
}

async function channelShape(channels: Channel[], ws: Workspace) {
	const ids = channels.map((c) => c.id);
	const me = ws.memberId ?? "";
	const [members, unread, creators, links, teams, mine] = await Promise.all([
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
		creatorsOf(channels),
		linksOf(channels, ws),
		teamsOf(channels),
		ids.length
			? db
					.select({
						channelId: tables.chat_member.channel_id,
						favorite: tables.chat_member.favorite,
						pinnedAt: tables.chat_member.pinned_at,
					})
					.from(tables.chat_member)
					.where(
						and(
							inArray(tables.chat_member.channel_id, ids),
							eq(tables.chat_member.member_id, me),
						),
					)
			: [],
	]);
	const favorites = new Set(
		mine.filter((m) => m.favorite).map((m) => m.channelId),
	);
	const pins = new Map(mine.map((m) => [m.channelId, m.pinnedAt]));
	const unreadBy = new Map(unread.map((u) => [u.channelId, Number(u.n)]));
	return channels.map((c) => ({
		id: c.id,
		kind: c.kind,
		name: teams.get(c.id)?.name ?? c.name,
		topic: c.topic,
		private: c.private,
		people: teams.get(c.id)?.people ?? members.get(c.id) ?? [],
		teamId: c.team_id,
		favorite: favorites.has(c.id),
		followsProject: c.follows_project,
		pinnedAt: pins.get(c.id)?.toISOString() ?? null,
		canDelete: canDelete(c, ws),
		unread: unreadBy.get(c.id) ?? 0,
		lastMessageAt: c.last_message_at?.toISOString() ?? null,
		general: isGeneral(c),
		creator: (c.created_by && creators.get(c.created_by)) || null,
		createdAt: c.created_at.toISOString(),
		// a task's chat also keeps its project (for who can see it): the task is what it's about
		link:
			(c.task_id && links.get(c.task_id)) ||
			(c.project_id && links.get(c.project_id)) ||
			null,
	}));
}

const isGeneral = (c: Channel) =>
	c.kind === "channel" && !c.team_id && c.name === "general";

/** Its maker or an admin may delete a channel; #general, team channels and DMs stay. */
const canDelete = (c: Channel, ws: Workspace) =>
	c.kind === "channel" &&
	!isGeneral(c) &&
	!c.team_id &&
	(c.created_by === ws.memberId ||
		can(ws.role, "manageAllContent", ws.settings));

async function creatorsOf(channels: Channel[]) {
	const ids = [
		...new Set(channels.map((c) => c.created_by).filter((x) => x !== null)),
	];
	const rows = ids.length
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
	return new Map(rows.map((r) => [r.id, r]));
}

/** Linked projects and tasks, only the ones this member may see (a title can be private). */
async function linksOf(channels: Channel[], ws: Workspace) {
	const projectIds = channels.flatMap((c) => c.project_id ?? []);
	const taskIds = channels.flatMap((c) => c.task_id ?? []);
	const [projects, tasks] = await Promise.all([
		projectIds.length
			? db
					.select({ id: tables.project.id, title: tables.project.title })
					.from(tables.project)
					.where(
						and(
							inArray(tables.project.id, projectIds),
							eq(tables.project.workspace_id, ws.id),
							isNull(tables.project.deleted_at),
							projectScope(ws),
						),
					)
			: [],
		taskIds.length
			? db
					.select({ id: tables.task.id, title: tables.task.name })
					.from(tables.task)
					.innerJoin(
						tables.project,
						eq(tables.project.id, tables.task.project_id),
					)
					.where(
						and(
							inArray(tables.task.id, taskIds),
							eq(tables.project.workspace_id, ws.id),
							isNull(tables.task.deleted_at),
							isNull(tables.project.deleted_at),
							projectScope(ws),
						),
					)
			: [],
	]);
	return new Map<string, { kind: string; id: string; title: string }>([
		...projects.map((p) => [p.id, { kind: "project", ...p }] as const),
		...tasks.map((t) => [t.id, { kind: "task", ...t }] as const),
	]);
}

/** This member's teams' channels, made on first use (one per team; the unique index keeps it so). */
async function ensureTeamChannels(ws: Workspace) {
	if (!ws.memberId) return;
	const missing = await db
		.select({ id: tables.team.id, name: tables.team.name })
		.from(tables.team)
		.innerJoin(
			tables.team_members,
			and(
				eq(tables.team_members.team_id, tables.team.id),
				eq(tables.team_members.member_id, ws.memberId),
				isNull(tables.team_members.deleted_at),
			),
		)
		.where(
			and(
				eq(tables.team.workspace_id, ws.id),
				isNull(tables.team.deleted_at),
				sql`not exists (select 1 from ${tables.chat_channel} where ${tables.chat_channel.team_id} = ${tables.team.id})`,
			),
		);
	if (!missing.length) return;
	await db
		.insert(tables.chat_channel)
		.values(
			missing.map((t) => ({
				workspace_id: ws.id,
				kind: "channel",
				// stored as team-<name> so it can never be (or block) #general; it shows the team's name
				name: `team-${channelName(t.name)}`.replace(/-$/, ""),
				private: true,
				team_id: t.id,
			})),
		)
		.onConflictDoNothing();
}

/** Lowercase, dashes for spaces, nothing else odd: "Design Reviews" -> "design-reviews". */
const channelName = (value: string) =>
	value
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9_-]/g, "")
		.slice(0, 80);

/** The workspace's #general, made on first use, with this member in it. */
async function ensureGeneral(ws: Workspace, channels: Channel[]) {
	if (!ws.memberId) return channels;
	let general = channels.find(isGeneral);
	if (!general) {
		// two first visits at once: the unique index keeps one, and both read it back
		await db
			.insert(tables.chat_channel)
			.values({
				workspace_id: ws.id,
				kind: "channel",
				name: "general",
				topic:
					"Everyone in the workspace, for anything that isn't about one project.",
			})
			.onConflictDoNothing();
		[general] = await db
			.select()
			.from(tables.chat_channel)
			.where(
				and(
					eq(tables.chat_channel.workspace_id, ws.id),
					eq(tables.chat_channel.kind, "channel"),
					eq(tables.chat_channel.name, "general"),
				),
			);
		if (!general) return channels;
		// an archived #general stays out of the list
		if (general.archived_at) return channels;
		channels = [general, ...channels];
	}
	// #general and your teams' channels count unread from when you first saw them
	// (and project chats: being able to see them makes you a member, for live updates)
	const everyones = channels.filter(
		(c) => isGeneral(c) || c.team_id || c.follows_project,
	);
	const joined = new Set(
		(
			await db
				.select({ id: tables.chat_member.channel_id })
				.from(tables.chat_member)
				.where(
					and(
						inArray(
							tables.chat_member.channel_id,
							everyones.map((c) => c.id),
						),
						eq(tables.chat_member.member_id, ws.memberId),
					),
				)
		).map((r) => r.id),
	);
	for (const c of everyones)
		if (!joined.has(c.id)) await join(c.id, ws.memberId);
	return channels;
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
	const parents = rows.filter((m) => !m.parent_id).map((m) => m.id);
	const replies = parents.length
		? await db
				.select({
					parentId: tables.chat_message.parent_id,
					n: count(),
					last: sql<string>`max(${tables.chat_message.created_at})`,
				})
				.from(tables.chat_message)
				.where(
					and(
						inArray(tables.chat_message.parent_id, parents),
						isNull(tables.chat_message.deleted_at),
					),
				)
				.groupBy(tables.chat_message.parent_id)
		: [];
	const repliesBy = new Map(replies.map((r) => [r.parentId, r]));
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
		parentId: m.parent_id,
		replyCount: Number(repliesBy.get(m.id)?.n ?? 0),
		lastReplyAt: repliesBy.get(m.id)?.last
			? new Date(repliesBy.get(m.id)?.last ?? "").toISOString()
			: null,
		pinned: !!m.pinned_at,
		attachments: m.attachments,
		shares: m.shares,
		mentions: m.mentions,
		mentionsMe: !!ws.memberId && m.mentions.includes(ws.memberId),
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

/** Who a message may mention: members picked from the @ list who can see the conversation and
 *  whose @Name is still in the text. */
async function checkMentions(
	ws: Workspace,
	channel: Channel,
	ids: string[],
	text: string,
) {
	const wanted = [...new Set(ids)].slice(0, 50);
	if (!wanted.length || !text) return [];
	const seenBy = audience(channel);
	const rows = await db
		.select({ id: tables.workspace_members.id, name: tables.user.name })
		.from(tables.workspace_members)
		.innerJoin(
			tables.user,
			eq(tables.user.id, tables.workspace_members.user_id),
		)
		.where(
			and(
				eq(tables.workspace_members.workspace_id, ws.id),
				inArray(tables.workspace_members.id, wanted),
				isNull(tables.workspace_members.deleted_at),
				seenBy ? inArray(tables.workspace_members.id, seenBy) : undefined,
			),
		);
	return rows.filter((r) => text.includes(`@${r.name}`)).map((r) => r.id);
}

const SHARE_KINDS = ["task", "project", "note", "bookmark"];
const MAX_SHARES = 5;

/** What a message may share: things the sender can see (each reader is checked again on show). */
async function checkShares(
	ws: Workspace,
	slug: string,
	shares: { kind: string; id: string }[],
) {
	if (shares.length > MAX_SHARES)
		badInput(`Share up to ${MAX_SHARES} things at a time`);
	const out: { kind: string; id: string }[] = [];
	for (const s of shares) {
		if (!SHARE_KINDS.includes(s.kind)) badInput("That can't be shared");
		if (out.some((o) => o.kind === s.kind && o.id === s.id)) continue;
		if (!(await findEmbed(ws, slug, s.kind, s.id)))
			badInput("You can only share what you can see");
		out.push({ kind: s.kind, id: s.id });
	}
	return out;
}

/** A message's files: only ones uploaded into this channel's folder, within the size limits. */
async function checkFiles(channelId: string, files: ChatAttachment[]) {
	if (files.length > MAX_FILES)
		badInput(`Send up to ${MAX_FILES} files at a time`);
	const { cloud } = cloudinary();
	const checked: ChatAttachment[] = [];
	for (const f of files) {
		if (!isUploadUrl(f.url, cloud, chatFolder(channelId)))
			badInput("That file didn't come from this conversation");
		await checkUploadedSize(f.url);
		const name = f.name.trim().slice(0, 255);
		if (!name) badInput("A file needs a name");
		checked.push({
			url: f.url,
			name,
			size: Math.max(0, Math.min(Math.round(f.size), 2 ** 31 - 1)),
			type: f.type.slice(0, 120),
			...(f.seconds != null && {
				seconds: Math.max(0, Math.min(Math.round(f.seconds), 3600)),
			}),
		});
	}
	return checked;
}

const body = (value: string) => {
	const text = value.trim();
	if (!text) badInput("Write a message first");
	if (text.length > MAX_BODY)
		badInput(`Messages can be up to ${MAX_BODY} characters`);
	return text;
};

/** Who can see a channel, as member ids (undefined: the whole workspace). */
const audience = (channel: Channel) =>
	channel.team_id
		? db
				.select({ id: tables.team_members.member_id })
				.from(tables.team_members)
				.where(
					and(
						eq(tables.team_members.team_id, channel.team_id),
						isNull(tables.team_members.deleted_at),
					),
				)
		: channel.private
			? db
					.select({ id: tables.chat_member.member_id })
					.from(tables.chat_member)
					.where(eq(tables.chat_member.channel_id, channel.id))
			: undefined;

/** Mentioned people, the rest of a DM, and whoever started a thread hear about a message. */
async function notifyChat(
	ws: Workspace,
	actorId: string,
	channel: Channel,
	text: string,
	mentionIds: string[],
	/** the message, for the notification to open at */
	messageId: string,
	parent?: Message,
) {
	const seenBy = audience(channel);
	const members = await db
		.select({
			id: tables.workspace_members.id,
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
				seenBy ? inArray(tables.workspace_members.id, seenBy) : undefined,
			),
		);
	const others = members.filter((m) => m.userId !== actorId);
	// exactly the people picked from the @ list (two people can share a name)
	const mentioned = others.filter((m) => mentionIds.includes(m.id));
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
	const starter = parent
		? others.find(
				(m) =>
					m.id === parent.author_id &&
					!mentioned.includes(m) &&
					!dmTo.includes(m),
			)
		: undefined;
	const where = channel.kind === "dm" ? "a message" : `#${channel.name}`;
	const base = {
		workspace_id: ws.id,
		actor_id: actorId,
		type: "mention",
		snippet: text.slice(0, 200),
		chat_channel_id: channel.id,
		chat_message_id: messageId,
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
		...(starter
			? [
					{
						...base,
						user_id: starter.userId,
						text: `replied to your message in ${where}`,
					},
				]
			: []),
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
			await ensureTeamChannels(w);
			const rows = await db
				.select()
				.from(tables.chat_channel)
				.where(visible(w))
				.orderBy(desc(tables.chat_channel.last_message_at));
			return channelShape(await ensureGeneral(w, rows), w);
		},
	},
	Query: {
		chatMessages: async (
			_: unknown,
			args: {
				slug: string;
				channelId: string;
				before?: string | null;
				parentId?: string | null;
			},
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
						// the channel shows threads' first messages; a thread, its replies
						args.parentId
							? eq(tables.chat_message.parent_id, args.parentId)
							: isNull(tables.chat_message.parent_id),
						before ? lt(tables.chat_message.created_at, before) : undefined,
					),
				)
				.orderBy(desc(tables.chat_message.created_at))
				.limit(PAGE);
			return messageShape(rows.reverse(), workspace);
		},
		chatPins: async (
			_: unknown,
			args: { slug: string; channelId: string },
			ctx: GraphQLContext,
		) => {
			const { workspace, channel } = await requireChannel(
				ctx,
				args.slug,
				args.channelId,
			);
			const rows = await db
				.select()
				.from(tables.chat_message)
				.where(
					and(
						eq(tables.chat_message.channel_id, channel.id),
						isNull(tables.chat_message.deleted_at),
						sql`${tables.chat_message.pinned_at} is not null`,
					),
				)
				.orderBy(desc(tables.chat_message.pinned_at))
				.limit(PAGE);
			return messageShape(rows, workspace);
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
				projectId?: string | null;
				taskId?: string | null;
			},
			ctx: GraphQLContext,
		) => {
			const { workspace } = await requireWorkspace(ctx, args.slug);
			const name = channelName(args.name);
			if (!name) badInput("Give the channel a name");
			if (name === "general") badInput("#general already exists");
			if (args.projectId && args.taskId)
				badInput("Link it to a project or a task, not both");
			// you can only link what you can see
			const projectId = args.projectId
				? (await requireProject(ctx, args.slug, args.projectId)).project.id
				: null;
			const taskId = args.taskId
				? (await requireTask(ctx, args.slug, args.taskId)).task.id
				: null;
			const [channel] = await db
				.insert(tables.chat_channel)
				.values({
					workspace_id: workspace.id,
					kind: "channel",
					name,
					topic: args.topic?.trim().slice(0, 250) || null,
					private: !!args.private,
					created_by: workspace.memberId,
					project_id: projectId,
					task_id: taskId,
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
			// just you: notes to yourself
			if (!ids.length || ids.length > 9) badInput("Pick up to eight people");
			const key = [...ids].sort().join(",");
			// the same people always land in the same DM
			const [existing] = await db
				.select()
				.from(tables.chat_channel)
				.where(
					and(
						eq(tables.chat_channel.workspace_id, workspace.id),
						eq(tables.chat_channel.kind, "dm"),
						// "C" sorts like JS's sort() above; the default collation may not
						sql`(select string_agg(${tables.chat_member.member_id}, ',' order by ${tables.chat_member.member_id} collate "C") from ${tables.chat_member} where ${tables.chat_member.channel_id} = ${tables.chat_channel.id}) = ${key}`,
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
			args: {
				slug: string;
				channelId: string;
				body: string;
				parentId?: string | null;
				attachments?: ChatAttachment[] | null;
				mentionIds?: string[] | null;
				shares?: { kind: string; id: string }[] | null;
			},
			ctx: GraphQLContext,
		) => {
			const { user, workspace, channel } = await requireChannel(
				ctx,
				args.slug,
				args.channelId,
			);
			const files = await checkFiles(channel.id, args.attachments ?? []);
			const shares = await checkShares(workspace, args.slug, args.shares ?? []);
			// a file or a shared item on its own is a message too
			const text =
				(files.length || shares.length) && !args.body.trim()
					? ""
					: body(args.body);
			const mentions = await checkMentions(
				workspace,
				channel,
				args.mentionIds ?? [],
				text,
			);
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
			// a reply goes on a message in this channel that isn't itself a reply
			const [parent] = args.parentId
				? await db
						.select()
						.from(tables.chat_message)
						.where(
							and(
								eq(tables.chat_message.id, args.parentId),
								eq(tables.chat_message.channel_id, channel.id),
								isNull(tables.chat_message.parent_id),
								isNull(tables.chat_message.deleted_at),
							),
						)
				: [];
			if (args.parentId && !parent) badInput("That thread isn't here any more");
			const [message] = await db
				.insert(tables.chat_message)
				.values({
					channel_id: channel.id,
					author_id: workspace.memberId,
					parent_id: parent?.id ?? null,
					body: text,
					attachments: files,
					shares,
					mentions,
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
			await notifyChat(
				workspace,
				user.id,
				channel,
				text ||
					(files.length === 1
						? `Sent ${files[0]?.name}`
						: files.length
							? `Sent ${files.length} files`
							: "Shared something"),
				mentions,
				// a thread reply opens at the thread's first message (that's in the conversation)
				parent?.id ?? message.id,
				parent,
			);
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
		chatUpload: async (
			_: unknown,
			args: { slug: string; channelId: string; file?: boolean | null },
			ctx: GraphQLContext,
		) => {
			const { channel } = await requireChannel(ctx, args.slug, args.channelId);
			const { cloud, key, secret } = cloudinary();
			// Cloudinary sorts any file into image, video (audio too) or raw by itself
			const kind = args.file ? "auto" : "image";
			const params = {
				folder: chatFolder(channel.id),
				public_id: generateNanoId().toLowerCase(),
				timestamp: Math.floor(Date.now() / 1000),
			};
			return {
				url: `https://api.cloudinary.com/v1_1/${cloud}/${kind}/upload`,
				apiKey: key,
				timestamp: params.timestamp,
				signature: signCloudinary(params, secret),
				publicId: params.public_id,
				folder: params.folder,
			};
		},
		pinChatMessage: async (
			_: unknown,
			args: { slug: string; id: string; pinned: boolean },
			ctx: GraphQLContext,
		) => {
			const { workspace, channel, message } = await requireMessage(
				ctx,
				args.slug,
				args.id,
				false,
			);
			// one pin per conversation: the new one takes the old one's place
			const updated = await db.transaction(async (tx) => {
				if (args.pinned)
					await tx
						.update(tables.chat_message)
						.set({ pinned_at: null, pinned_by: null })
						.where(
							and(
								eq(tables.chat_message.channel_id, channel.id),
								ne(tables.chat_message.id, message.id),
								sql`${tables.chat_message.pinned_at} is not null`,
							),
						);
				const [row] = await tx
					.update(tables.chat_message)
					.set(
						args.pinned
							? { pinned_at: new Date(), pinned_by: workspace.memberId }
							: { pinned_at: null, pinned_by: null },
					)
					.where(eq(tables.chat_message.id, message.id))
					.returning();
				return row;
			});
			if (!updated) badInput("Message not found");
			announceChat(
				workspace.id,
				channel.id,
				{ type: "edit", id: message.id },
				ctx.tab,
			);
			return (await messageShape([updated], workspace))[0];
		},
		deleteChatChannel: async (
			_: unknown,
			args: { slug: string; channelId: string },
			ctx: GraphQLContext,
		) => {
			const { workspace, channel } = await requireChannel(
				ctx,
				args.slug,
				args.channelId,
			);
			if (!canDelete(channel, workspace))
				badInput(
					isGeneral(channel) || channel.team_id || channel.kind === "dm"
						? "This conversation can't be deleted"
						: "Only the person who made this channel, or an admin, can delete it",
				);
			// archived: it leaves everyone's list, and its messages stop being readable
			await db
				.update(tables.chat_channel)
				.set({ archived_at: new Date() })
				.where(eq(tables.chat_channel.id, channel.id));
			announceChat(
				workspace.id,
				channel.id,
				{ type: "delete", id: channel.id },
				ctx.tab,
			);
			return true;
		},
		openChatFor: async (
			_: unknown,
			args: { slug: string; kind: string; id: string },
			ctx: GraphQLContext,
		) => {
			if (args.kind !== "project" && args.kind !== "task")
				badInput("Only projects and tasks have their own chat");
			// you can only open the chat of something you can see
			const forTask =
				args.kind === "task"
					? await requireTask(ctx, args.slug, args.id)
					: null;
			const { workspace, project } =
				forTask ?? (await requireProject(ctx, args.slug, args.id));
			const task = forTask?.task ?? null;
			const mine = () =>
				db
					.select()
					.from(tables.chat_channel)
					.where(
						and(
							eq(tables.chat_channel.workspace_id, workspace.id),
							eq(tables.chat_channel.follows_project, true),
							task
								? eq(tables.chat_channel.task_id, task.id)
								: and(
										eq(tables.chat_channel.project_id, project.id),
										isNull(tables.chat_channel.task_id),
									),
							isNull(tables.chat_channel.archived_at),
						),
					);
			let [channel] = await mine();
			if (!channel) {
				const title = task?.name ?? project.title;
				// two people opening it at once: the unique index keeps one, both read it back
				await db
					.insert(tables.chat_channel)
					.values({
						workspace_id: workspace.id,
						kind: "channel",
						name: channelName(title) || (task ? "task" : "project"),
						topic: task
							? `About the task “${task.name}” in ${project.title}.`
							: `Everything about ${project.title}.`,
						// it follows the project: private to everyone else
						private: true,
						follows_project: true,
						project_id: project.id,
						task_id: task?.id ?? null,
						created_by: workspace.memberId,
					})
					.onConflictDoNothing();
				[channel] = await mine();
			}
			if (!channel) badInput("Couldn't open the chat");
			await join(channel.id, workspace.memberId ?? "");
			return (await channelShape([channel], workspace))[0];
		},
		pinChatChannel: async (
			_: unknown,
			args: { slug: string; channelId: string; pinned: boolean },
			ctx: GraphQLContext,
		) => {
			const { workspace, channel } = await requireChannel(
				ctx,
				args.slug,
				args.channelId,
			);
			const pinned_at = args.pinned ? new Date() : null;
			await db
				.insert(tables.chat_member)
				.values({
					channel_id: channel.id,
					member_id: workspace.memberId ?? "",
					pinned_at,
				})
				.onConflictDoUpdate({
					target: [tables.chat_member.channel_id, tables.chat_member.member_id],
					set: { pinned_at },
				});
			return true;
		},
		favoriteChatChannel: async (
			_: unknown,
			args: { slug: string; channelId: string; favorite: boolean },
			ctx: GraphQLContext,
		) => {
			const { workspace, channel } = await requireChannel(
				ctx,
				args.slug,
				args.channelId,
			);
			await db
				.insert(tables.chat_member)
				.values({
					channel_id: channel.id,
					member_id: workspace.memberId ?? "",
					favorite: args.favorite,
				})
				.onConflictDoUpdate({
					target: [tables.chat_member.channel_id, tables.chat_member.member_id],
					set: { favorite: args.favorite },
				});
			return true;
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
