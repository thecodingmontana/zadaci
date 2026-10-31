import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Av } from "#/components/q/av";
import { Modal } from "#/components/q/modal";
import { Select } from "#/components/settings/ui";
import { realtimeToken } from "#/components/shell/live-updates";
import {
	CHAT_CHANNELS,
	CHAT_LINK_OPTIONS,
	CHAT_MESSAGES,
	CHAT_PINS,
	type ChatChannel,
	type ChatMessage,
	CREATE_CHAT_CHANNEL,
	FAVORITE_CHAT_CHANNEL,
	MARK_CHAT_READ,
	OPEN_CHAT_DM,
	PIN_CHAT_CHANNEL,
	PIN_CHAT_MESSAGE,
} from "#/graphql/chat-operations";
import { NOTE_PEOPLE } from "#/graphql/note-operations";
import { REALTIME_CONFIG } from "#/graphql/operations";
import { useOnline } from "#/lib/online";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { ChannelDetails } from "./chat-details";
import {
	ChatNamesContext,
	Composer,
	groupedWith,
	type Mentionable,
	MessageRow,
	MessagesSkeleton,
} from "./chat-message";
import { ChatNav, Face, titleOf, type Via } from "./chat-nav";
import { OutboxRow, useOutbox } from "./chat-outbox";
import { ThreadPanel } from "./chat-thread";

// Team chat: its own sidebar of conversations (chat-nav.tsx; a drawer on a phone), the open
// conversation, and beside it the channel's details or a thread. New messages, typing and who's
// online arrive over Supabase Realtime; the messages themselves always load through the API,
// which checks who may read them.

const TYPING_MS = 4000;
const PAGE = 50;
/** how long a side panel takes to slide out (ui.css: chat-side-out) */
const SIDE_OUT_MS = 180;
const lastKey = (slug: string) => `zadaci:chat-last:${slug}`;

export function ChatView({
	slug,
	channelId,
	starting,
	via,
	messageId,
}: {
	slug: string;
	/** which copy of it was clicked in the chat sidebar */
	via?: Via;
	/** a message to open at (from a notification) */
	messageId?: string;
	/** none: the last one you had open, else #general */
	channelId?: string;
	/** "Add channel" was picked */
	starting?: "channel";
}) {
	const navigate = useNavigate();
	const { data, error, refetch } = useQuery(CHAT_CHANNELS, {
		variables: { slug },
	});
	const people =
		useQuery(NOTE_PEOPLE, { variables: { slug } }).data?.workspace?.members ??
		[];
	const me = people.find((p) => p.isMe);
	const channels = data?.workspace?.chatChannels ?? [];
	const [drawer, setDrawer] = useState(false);

	const [openDm] = useMutation(OPEN_CHAT_DM, {
		refetchQueries: ["ChatChannels"],
	});
	// opening Chat with no ?c returns to where you were (in this browser), else #general.
	// Read after mount: the server can't know it. undefined = not read yet
	const [last, setLast] = useState<string | null>();
	useEffect(() => {
		try {
			setLast(localStorage.getItem(lastKey(slug)));
		} catch {
			setLast(null);
		}
	}, [slug]);
	const open = channelId
		? channels.find((c) => c.id === channelId)
		: last === undefined
			? undefined
			: (channels.find((c) => c.id === last) ??
				channels.find((c) => c.general));
	const openId = open?.id;
	useEffect(() => {
		if (!openId) return;
		try {
			localStorage.setItem(lastKey(slug), openId);
		} catch {
			// private mode: Chat just opens #general next time
		}
	}, [slug, openId]);

	const [star] = useMutation(FAVORITE_CHAT_CHANNEL, {
		refetchQueries: ["ChatChannels"],
	});
	const [pinTop] = useMutation(PIN_CHAT_CHANNEL, {
		refetchQueries: ["ChatChannels"],
	});
	const talkTo = async (
		memberIds: string[],
		opts?: { favorite?: boolean; pin?: boolean },
	) => {
		try {
			const { data: dm } = await openDm({ variables: { slug, memberIds } });
			// from the ⋯ menu: just star or pin it, without opening it
			if (dm && (opts?.favorite || opts?.pin)) {
				const channelId = dm.openChatDm.id;
				if (opts.favorite)
					await star({ variables: { slug, channelId, favorite: true } });
				if (opts.pin)
					await pinTop({ variables: { slug, channelId, pinned: true } });
				return;
			}
			if (dm)
				void navigate({
					to: "/w/$slug/chat",
					params: { slug },
					search: { c: dm.openChatDm.id },
				});
		} catch (e) {
			toast.error("Couldn't open the conversation", {
				desc: (e as Error).message,
			});
		}
	};

	return (
		<div className="page flush chat">
			<ChatNav
				slug={slug}
				channels={data?.workspace?.chatChannels}
				people={people}
				openId={openId}
				via={via}
				drawer={drawer}
				onOpenDm={(ids, opts) => void talkTo(ids, opts)}
				onClose={() => setDrawer(false)}
			/>
			{open ? (
				<Conversation
					key={open.id}
					slug={slug}
					channel={open}
					title={titleOf(open, me?.id)}
					me={me}
					everyone={people}
					openAt={messageId}
					onMenu={() => setDrawer(true)}
				/>
			) : // still finding the conversation: the whole of it as a placeholder
			(!data && !error) || (data && !channelId && last === undefined) ? (
				<ConversationSkeleton onMenu={() => setDrawer(true)} />
			) : (
				<section className="chat-main chat-blank faint">
					<button
						type="button"
						className="ibtn ibtn-sm chat-menu"
						aria-label="Conversations"
						onClick={() => setDrawer(true)}
					>
						<span
							className="icon-[solar--sidebar-minimalistic-linear] size-4"
							aria-hidden="true"
						/>
					</button>
					{error && !data ? (
						<div className="chat-failed">
							<p>Couldn't load your conversations.</p>
							<button
								type="button"
								className="btn btn-secondary btn-sm"
								onClick={() => void refetch()}
							>
								Try again
							</button>
						</div>
					) : data && channelId ? (
						"This conversation isn't here any more."
					) : (
						""
					)}
				</section>
			)}
			{starting && (
				<StartDialog
					slug={slug}
					people={people.filter((p) => !p.isMe)}
					onClose={() =>
						void navigate({
							to: ".",
							search: (prev) => ({ ...prev, new: undefined }),
							replace: true,
						})
					}
				/>
			)}
		</div>
	);
}

/** Before the conversation is known: its header, a screen of messages and the box, as placeholders. */
export function ConversationSkeleton({ onMenu }: { onMenu: () => void }) {
	return (
		<section className="chat-main" aria-busy="true">
			<header className="chat-h">
				<button
					type="button"
					className="ibtn ibtn-sm chat-menu"
					aria-label="Conversations"
					onClick={onMenu}
				>
					<span
						className="icon-[solar--sidebar-minimalistic-linear] size-4"
						aria-hidden="true"
					/>
				</button>
				<span className="chat-h-ic" aria-hidden="true">
					<span className="icon-[solar--hashtag-linear] size-4" />
				</span>
				<span
					className="sk"
					style={{ width: 120, height: 14 }}
					aria-hidden="true"
				/>
			</header>
			<div className="chat-msgs">
				<MessagesSkeleton />
			</div>
			<div className="chat-typing" />
			{/* the message box is the same everywhere: shown as is, waiting */}
			<div className="chat-compose">
				<textarea
					rows={1}
					disabled
					placeholder="Write a message…"
					aria-label="Message"
				/>
				<div className="chat-compose-tools">
					<button type="button" className="btn btn-secondary btn-sm" disabled>
						<span
							className="icon-[solar--paperclip-linear] size-4"
							aria-hidden="true"
						/>
						<span className="chat-h-label">Add file</span>
					</button>
					<span className="sp" />
					<button
						type="button"
						className="btn btn-primary btn-sm chat-send"
						disabled
						aria-label="Send"
					>
						<span
							className="icon-[solar--arrow-up-linear] size-4"
							aria-hidden="true"
						/>
					</button>
				</div>
			</div>
		</section>
	);
}

/** The start of a conversation, Discord-style: what this place is. */
function Welcome({
	channel,
	title,
	face,
}: {
	channel: ChatChannel;
	title: string;
	/** a DM's other person (you, in your own), found by id: two people can share a name */
	face: { name: string; image: string | null } | undefined;
}) {
	const dm = channel.kind === "dm";
	const self = dm && channel.people.length === 1;
	return (
		<div className="chat-welcome">
			{dm ? (
				<Av
					name={face?.name ?? title}
					image={face?.image}
					className="chat-welcome-av"
				/>
			) : (
				<span className="chat-welcome-ic" aria-hidden="true">
					<span
						className={cn(
							"size-8",
							channel.teamId
								? "icon-[solar--users-group-two-rounded-linear]"
								: channel.private
									? "icon-[solar--lock-keyhole-minimalistic-linear]"
									: "icon-[solar--hashtag-linear]",
						)}
					/>
				</span>
			)}
			<h2>{dm ? title : `Welcome to #${title}!`}</h2>
			<p className="faint">
				{self
					? "A place for drafts, links and reminders. Only you can see it."
					: dm
						? `This is the beginning of your direct messages with ${title}.`
						: channel.teamId
							? `This is the start of the ${title} team's channel. Everyone on the team is here.`
							: `This is the start of the #${title} channel.${channel.topic ? ` ${channel.topic}` : ""}`}
			</p>
		</div>
	);
}

export function Conversation({
	slug,
	channel,
	title,
	me,
	everyone,
	openAt,
	onMenu,
}: {
	slug: string;
	channel: ChatChannel;
	title: string;
	me: { id: string; name: string; image: string | null } | undefined;
	/** the workspace's members */
	everyone: Mentionable[];
	/** a message to scroll to once it's open */
	openAt?: string;
	onMenu: () => void;
}) {
	const client = useApolloClient();
	// who can be @mentioned: everyone in an open channel, otherwise the people in it (not you)
	const mentionable = (
		channel.private || channel.teamId ? channel.people : everyone
	).filter((p) => p.id !== me?.id);
	const names = new Map(everyone.map((p) => [p.id, p.name]));
	const meName = me?.name ?? "";
	const dmFace =
		channel.people.find((p) => p.id !== me?.id) ?? channel.people[0];
	const variables = { slug, channelId: channel.id };
	const { data, refetch } = useQuery(CHAT_MESSAGES, { variables });
	const [older, setOlder] = useState<ChatMessage[]>([]);
	const [noMore, setNoMore] = useState(false);
	const messages = [...older, ...(data?.chatMessages ?? [])];
	const [markRead] = useMutation(MARK_CHAT_READ, {
		refetchQueries: ["ChatChannels"],
	});
	const [typing, setTyping] = useState<Record<string, number>>({});
	// what you send shows at once; the real message takes its place when the server has it
	const outbox = useOutbox({
		slug,
		channelId: channel.id,
		onSent: (message) =>
			client.cache.updateQuery({ query: CHAT_MESSAGES, variables }, (prev) =>
				// the live refresh may have brought it in already
				prev?.chatMessages.some((m) => m.id === message.id)
					? prev
					: { chatMessages: [...(prev?.chatMessages ?? []), message] },
			),
	});
	// beside the conversation: the details (on Info or Pins), or a thread (by its first message's id)
	// one of your messages being edited in the box below
	const [editing, setEditing] = useState<ChatMessage | null>(null);
	const [side, setSide] = useState<
		"details" | "pins" | { thread: string } | null
	>(null);
	const pinned = useQuery(CHAT_PINS, { variables }).data?.chatPins[0];
	const [unpin] = useMutation(PIN_CHAT_MESSAGE, {
		refetchQueries: ["ChatPins", "ChatMessages"],
	});
	// the pinned bar: show the message (a reply opens its thread; one further back, the Pins tab)
	// takes you to a message: loads earlier pages until it's there, then scrolls it into view
	const goTo = async (target: string) => {
		if (!document.getElementById(`m-${target}`)) {
			// further back than what's loaded: load earlier pages until it's there
			const pages: ChatMessage[] = [];
			let cursor = messages[0]?.createdAt;
			try {
				while (cursor && !pages.some((m) => m.id === target)) {
					const { data: page } = await client.query({
						query: CHAT_MESSAGES,
						variables: { ...variables, before: cursor },
						fetchPolicy: "network-only",
					});
					const rows = page?.chatMessages ?? [];
					pages.unshift(...rows);
					if (rows.length < PAGE) {
						setNoMore(true);
						break;
					}
					cursor = rows[0]?.createdAt;
				}
			} catch {
				toast.error("Couldn't load the pinned message");
				return;
			}
			setOlder((o) => [...pages, ...o]);
			// wait for those rows to be on screen
			await new Promise((done) =>
				requestAnimationFrame(() => requestAnimationFrame(done)),
			);
		}
		const el = document.getElementById(`m-${target}`);
		if (!el) return void toast.error("The pinned message isn't here any more");
		el.scrollIntoView({ block: "center", behavior: "smooth" });
		el.classList.add("flash");
		setTimeout(() => el.classList.remove("flash"), 1600);
	};
	const showPinned = () => {
		if (!pinned) return;
		// a reply: open its thread, and bring the message it answers into view
		if (pinned.parentId) setSide({ thread: pinned.parentId });
		void goTo(pinned.parentId ?? pinned.id);
	};
	// opened from a notification: go to its message once the conversation has loaded
	const opened = useRef(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: once, when the first page is in
	useEffect(() => {
		if (!openAt || !data || opened.current) return;
		opened.current = true;
		requestAnimationFrame(() => void goTo(openAt));
	}, [openAt, !!data]);
	// who's online (shared by every open tab of the workspace; LiveUpdates keeps it current)
	const shared = useOnline();
	// you're online while you're looking, even before presence connects
	const online = { has: (id: string) => id === me?.id || shared.has(id) };
	// the people in it: everyone in the workspace for an open channel
	const members =
		channel.private || channel.teamId || channel.kind === "dm"
			? channel.people
			: everyone;
	const memberIds = members.map((p) => p.id);
	// a side panel slides out before it goes
	const [closing, setClosing] = useState(false);
	const closeSide = () => {
		setClosing(true);
		setTimeout(() => {
			setSide(null);
			setClosing(false);
		}, SIDE_OUT_MS);
	};
	const onlineCount = memberIds.filter((id) => online.has(id)).length;
	const say = useRef<(event: string, payload: object) => void>(() => {});
	const list = useRef<HTMLDivElement>(null);
	const config = useQuery(REALTIME_CONFIG, { fetchPolicy: "cache-first" }).data
		?.realtime;
	const thread =
		typeof side === "object" && side
			? messages.find((m) => m.id === side.thread)
			: undefined;
	const details = side === "details" || side === "pins";
	const hasEarlier = (data?.chatMessages.length ?? 0) >= PAGE && !noMore;

	// opening it, and each new message while it's open, marks it read
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-run as messages arrive
	useEffect(() => {
		void markRead({ variables }).catch(() => {});
	}, [data?.chatMessages.length]);

	// open at the newest message; after that, follow new ones only when you're near the bottom
	const [landed, setLanded] = useState(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-run as messages arrive
	useLayoutEffect(() => {
		const el = list.current;
		if (!el || !data) return;
		if (!landed) {
			el.scrollTop = el.scrollHeight;
			setLanded(true);
		} else if (el.scrollHeight - el.scrollTop - el.clientHeight < 160)
			el.scrollTop = el.scrollHeight;
	}, [messages.length, !!data]);

	// live: new messages (and thread replies), typing and who's here, on this conversation's
	// private channel
	// biome-ignore lint/correctness/useExhaustiveDependencies: one connection per open conversation
	useEffect(() => {
		if (!config) return;
		let stop: (() => void) | undefined;
		let gone = false;
		void import("@supabase/realtime-js").then(async ({ RealtimeClient }) => {
			if (gone) return;
			// shortcut: a second socket while chat is open (LiveUpdates holds the other); share one if it matters
			const realtime = new RealtimeClient(`${config.url}/realtime/v1`, {
				params: { apikey: config.anonKey },
				...(config.private && { accessToken: realtimeToken }),
			});
			// the token before the join (see LiveUpdates)
			if (config.private) await realtime.setAuth();
			if (gone) return realtime.disconnect();
			const room = realtime
				.channel(`chat:${channel.id}`, {
					config: { private: config.private },
				})
				.on(
					"broadcast",
					{ event: "message" },
					() =>
						void client.refetchQueries({
							include: ["ChatMessages", "ChatPins"],
						}),
				)
				.on("broadcast", { event: "typing" }, (m) => {
					const name = String(m.payload?.name ?? "");
					// by id, not name: two people can share a name
					if (name && m.payload?.id !== me?.id)
						setTyping((t) => ({ ...t, [name]: Date.now() }));
				})
				.subscribe();
			say.current = (event, payload) =>
				void room.send({ type: "broadcast", event, payload });
			stop = () => {
				void realtime.removeChannel(room);
				realtime.disconnect();
			};
		});
		return () => {
			gone = true;
			stop?.();
		};
	}, [config, channel.id]);

	// "typing…" fades a few seconds after the last keystroke
	useEffect(() => {
		if (!Object.keys(typing).length) return;
		const id = setInterval(
			() =>
				setTyping((t) =>
					Object.fromEntries(
						Object.entries(t).filter(([, at]) => Date.now() - at < TYPING_MS),
					),
				),
			1000,
		);
		return () => clearInterval(id);
	}, [typing]);

	// earlier messages load as you scroll up to them, keeping your place (the page above grows
	// while what you're reading stays put)
	const [loadingOlder, setLoadingOlder] = useState(false);
	const keepPlace = useRef<{ height: number; top: number } | null>(null);
	const top = useRef<HTMLDivElement>(null);
	const loadOlder = async () => {
		const first = messages[0];
		const el = list.current;
		if (!first || !el || loadingOlder) return;
		setLoadingOlder(true);
		try {
			const { data: page } = await client.query({
				query: CHAT_MESSAGES,
				variables: { ...variables, before: first.createdAt },
				fetchPolicy: "network-only",
			});
			const rows = page?.chatMessages ?? [];
			if (rows.length < PAGE) setNoMore(true);
			keepPlace.current = { height: el.scrollHeight, top: el.scrollTop };
			setOlder((o) => [...rows, ...o]);
		} catch (e) {
			toast.error("Couldn't load earlier messages", {
				desc: (e as Error).message,
			});
		} finally {
			setLoadingOlder(false);
		}
	};
	// biome-ignore lint/correctness/useExhaustiveDependencies: after each earlier page lands
	useLayoutEffect(() => {
		const el = list.current;
		const was = keepPlace.current;
		if (!el || !was) return;
		el.scrollTop = el.scrollHeight - was.height + was.top;
		keepPlace.current = null;
	}, [older.length]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: watch the top while there's more
	useEffect(() => {
		const el = top.current;
		if (!el || !landed || !hasEarlier || loadingOlder) return;
		const seen = new IntersectionObserver(
			([e]) => {
				if (e?.isIntersecting) void loadOlder();
			},
			{ root: list.current, rootMargin: "300px 0px 0px 0px" },
		);
		seen.observe(el);
		return () => seen.disconnect();
	}, [landed, hasEarlier, loadingOlder, older.length]);
	const typers = Object.keys(typing);

	return (
		<ChatNamesContext.Provider value={{ slug, names }}>
			<section className="chat-main">
				<header className="chat-h">
					<button
						type="button"
						className="ibtn ibtn-sm chat-menu"
						aria-label="Conversations"
						onClick={onMenu}
					>
						<span
							className="icon-[solar--sidebar-minimalistic-linear] size-4"
							aria-hidden="true"
						/>
					</button>
					{channel.kind === "dm" ? (
						// a DM shows who it's with (yourself, in your own), with their online dot
						<Face
							name={dmFace?.name ?? title}
							image={dmFace?.image}
							online={!!dmFace && online.has(dmFace.id)}
							className="chat-h-av"
						/>
					) : (
						<span className="chat-h-ic" aria-hidden="true">
							<span
								className={cn(
									"size-4",
									channel.teamId
										? "icon-[solar--users-group-two-rounded-linear]"
										: channel.private
											? "icon-[solar--lock-keyhole-minimalistic-linear]"
											: "icon-[solar--hashtag-linear]",
								)}
							/>
						</span>
					)}
					<span className="chat-h-title">
						<b className="trunc">{title}</b>
						<span className="faint chat-h-sub">
							{channel.kind === "dm"
								? channel.people.length > 2
									? `${onlineCount} of ${channel.people.length} online`
									: dmFace && online.has(dmFace.id)
										? "Online"
										: "Offline"
								: `${onlineCount} online · ${memberIds.length} ${memberIds.length === 1 ? "member" : "members"}`}
						</span>
					</span>
					<span className="sp" />
					<button
						type="button"
						className={cn("ibtn ibtn-sm", details && "on")}
						aria-pressed={details}
						aria-label="Details"
						data-tip="Details"
						onClick={() => (details ? closeSide() : setSide("details"))}
					>
						{/* the sidebar icon, facing the panel it opens on the right */}
						<span
							className="icon-[solar--sidebar-minimalistic-linear] size-4 -scale-x-100"
							aria-hidden="true"
						/>
					</button>
				</header>
				{pinned && (
					<div className="chat-pinbar">
						<span
							className="icon-[solar--pin-bold] size-4 shrink-0 chat-pinbar-ic"
							aria-hidden="true"
						/>
						<button
							type="button"
							className="chat-pinbar-msg"
							onClick={() => void showPinned()}
						>
							<span className="chat-pinbar-label">Pinned</span>
							<span className="trunc">
								<b>{pinned.author?.name ?? "Deleted user"}:</b>{" "}
								{pinned.body ||
									(pinned.attachments.length === 1
										? pinned.attachments[0]?.name
										: `${pinned.attachments.length} files`)}
							</span>
						</button>
						<button
							type="button"
							className="ibtn ibtn-xs"
							aria-label="Unpin"
							data-tip="Unpin"
							onClick={() =>
								void unpin({
									variables: { slug, id: pinned.id, pinned: false },
								}).catch(() => toast.error("Couldn't unpin"))
							}
						>
							<span
								className="icon-[solar--close-circle-linear] size-4"
								aria-hidden="true"
							/>
						</button>
					</div>
				)}
				<div className="chat-msgs" ref={list}>
					{!data && <MessagesSkeleton />}
					{/* the start sits at the top only once there's nothing earlier to load */}
					{data && !hasEarlier && (
						<Welcome channel={channel} title={title} face={dmFace} />
					)}
					{hasEarlier && (
						<div ref={top} className="chat-older" aria-live="polite">
							{loadingOlder ? (
								<>
									<span
										className="icon-[hugeicons--loading-03] size-4 animate-spin"
										aria-hidden="true"
									/>
									Loading earlier messages…
								</>
							) : (
								<button
									type="button"
									className="btn btn-ghost btn-sm"
									onClick={() => void loadOlder()}
								>
									Load earlier messages
								</button>
							)}
						</div>
					)}
					{messages.map((m, i) => (
						<MessageRow
							key={m.id}
							slug={slug}
							message={m}
							grouped={groupedWith(m, messages[i - 1])}
							onChange={() => void refetch()}
							onThread={() => setSide({ thread: m.id })}
							onEdit={() => setEditing(m)}
						/>
					))}
					{outbox.items.map((item, i) => (
						<OutboxRow
							key={item.id}
							item={item}
							me={me}
							waiting={outbox.items.slice(0, i).some((x) => x.failed)}
							onRetry={() => outbox.retry(item.id)}
							onDiscard={() => outbox.discard(item.id)}
						/>
					))}
				</div>
				<div className="chat-typing faint" aria-live="polite">
					{typers.length
						? `${typers.join(", ")} ${typers.length > 1 ? "are" : "is"} typing…`
						: ""}
				</div>
				<Composer
					slug={slug}
					placeholder={
						channel.kind !== "dm"
							? `Message #${title}`
							: channel.people.length === 1
								? "Write a note to yourself…"
								: `Message ${title}`
					}
					onTyping={() => say.current("typing", { name: meName, id: me?.id })}
					people={mentionable}
					editing={editing}
					onEditEnd={() => setEditing(null)}
					onSend={(body, files, mentionIds, shares) => {
						outbox.send(body, files, mentionIds, shares);
						requestAnimationFrame(() => {
							if (list.current)
								list.current.scrollTop = list.current.scrollHeight;
						});
					}}
				/>
			</section>
			{details && (
				<ChannelDetails
					key={side}
					slug={slug}
					channel={channel}
					tab={side === "pins" ? "pins" : "info"}
					members={members}
					meId={me?.id}
					closing={closing}
					onClose={closeSide}
				/>
			)}
			{thread && (
				<ThreadPanel
					key={thread.id}
					slug={slug}
					parent={thread}
					me={me}
					people={mentionable}
					closing={closing}
					onClose={closeSide}
					onChange={() => void refetch()}
				/>
			)}
		</ChatNamesContext.Provider>
	);
}

/** "Add channel": a name, what it's for, what it's about, and who can see it. */
function StartDialog({
	slug,
	people,
	onClose,
}: {
	slug: string;
	people: { id: string; name: string; image: string | null }[];
	onClose: () => void;
}) {
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [isPrivate, setPrivate] = useState(false);
	const [picked, setPicked] = useState<string[]>([]);
	const [topic, setTopic] = useState("");
	const [linkKind, setLinkKind] = useState<"none" | "project" | "task">("none");
	const [link, setLink] = useState<{ id: string; name: string } | null>(null);
	const options = useQuery(CHAT_LINK_OPTIONS, {
		variables: { slug },
		skip: linkKind === "none",
	}).data?.workspace;
	const projectTitle = new Map(options?.projects.map((p) => [p.id, p.title]));
	const choices =
		linkKind === "task"
			? (options?.tasks ?? []).map((t) => ({
					id: t.id,
					name: t.name,
					label: `${t.name} · ${projectTitle.get(t.projectId) ?? ""}`,
				}))
			: (options?.projects ?? []).map((p) => ({
					id: p.id,
					name: p.title,
					label: p.title,
				}));
	const [create, creating] = useMutation(CREATE_CHAT_CHANNEL, {
		refetchQueries: ["ChatChannels"],
	});
	const busy = creating.loading;

	// the server says the same (and slugs names the same way): there's only one #general
	const taken =
		name
			.trim()
			.toLowerCase()
			.replace(/\s+/g, "-")
			.replace(/[^a-z0-9_-]/g, "") === "general";
	const go = async () => {
		try {
			const id = (
				await create({
					variables: {
						slug,
						name,
						topic: topic.trim() || undefined,
						private: isPrivate,
						memberIds: picked,
						projectId: linkKind === "project" ? link?.id : undefined,
						taskId: linkKind === "task" ? link?.id : undefined,
					},
				})
			).data?.createChatChannel.id;
			onClose();
			if (id)
				void navigate({
					to: "/w/$slug/chat",
					params: { slug },
					search: { c: id },
				});
		} catch (e) {
			toast.error("Couldn't start it", { desc: (e as Error).message });
		}
	};
	const choose = (id: string) =>
		setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

	return (
		<Modal
			open
			onOpenChange={(o) => !o && onClose()}
			title="New channel"
			busy={busy}
			footer={
				<>
					<span className="sp" />
					<button
						type="button"
						className="btn btn-secondary btn-sm"
						onClick={onClose}
					>
						Cancel
					</button>
					<button
						type="button"
						className="btn btn-primary btn-sm"
						disabled={busy || !name.trim() || taken}
						onClick={() => void go()}
					>
						Create channel
					</button>
				</>
			}
		>
			<div className="modal-b chat-start">
				<input
					className="input"
					placeholder="Name, like design-reviews"
					aria-label="Channel name"
					aria-invalid={taken}
					aria-describedby={taken ? "chat-name-taken" : undefined}
					value={name}
					maxLength={80}
					onChange={(e) => setName(e.target.value)}
				/>
				{taken && (
					<p id="chat-name-taken" className="chat-field-error">
						#general is the workspace's channel for everyone. Pick another name.
					</p>
				)}
				<input
					className="input"
					placeholder="What it's for (optional)"
					aria-label="Topic"
					value={topic}
					maxLength={250}
					onChange={(e) => setTopic(e.target.value)}
				/>
				<div className="chat-linkto">
					<span className="faint">Link to</span>
					<div className="seg">
						{(["none", "project", "task"] as const).map((k) => (
							<button
								key={k}
								type="button"
								aria-pressed={linkKind === k}
								className={cn(linkKind === k && "on")}
								onClick={() => {
									setLinkKind(k);
									setLink(null);
								}}
							>
								{k === "none"
									? "Nothing"
									: k === "project"
										? "A project"
										: "A task"}
							</button>
						))}
					</div>
				</div>
				{linkKind !== "none" && (
					<Select
						label={linkKind === "task" ? "Task" : "Project"}
						className="w-full"
						value={link?.id ?? ""}
						options={[
							["", linkKind === "task" ? "Pick a task" : "Pick a project"],
							...choices.map((c) => [c.id, c.label] as const),
						]}
						onChange={(id) => {
							const picked = choices.find((c) => c.id === id);
							setLink(picked ? { id, name: picked.name } : null);
							// a channel about it is named after it, unless you named it already
							if (picked && !name.trim()) setName(picked.name);
						}}
					/>
				)}
				<label className="row chat-check">
					<input
						type="checkbox"
						checked={isPrivate}
						onChange={(e) => setPrivate(e.target.checked)}
					/>
					Private: only the people you add can see it
				</label>

				{isPrivate && (
					<fieldset className="chat-pick">
						<legend className="sr-only">People</legend>
						{people.map((p) => (
							<label key={p.id} className="row chat-person">
								<input
									type="checkbox"
									checked={picked.includes(p.id)}
									onChange={() => choose(p.id)}
								/>
								<Av name={p.name} image={p.image} />
								<span className="trunc">{p.name}</span>
							</label>
						))}
						{!people.length && (
							<p className="faint">Invite teammates to chat with them.</p>
						)}
					</fieldset>
				)}
			</div>
		</Modal>
	);
}
