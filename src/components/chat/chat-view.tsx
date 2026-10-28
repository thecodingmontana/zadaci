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
	type ChatChannel,
	type ChatMessage,
	CREATE_CHAT_CHANNEL,
	FAVORITE_CHAT_CHANNEL,
	MARK_CHAT_READ,
	OPEN_CHAT_DM,
} from "#/graphql/chat-operations";
import { NOTE_PEOPLE } from "#/graphql/note-operations";
import { REALTIME_CONFIG } from "#/graphql/operations";
import { TAB_ID } from "#/lib/tab";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { ChannelDetails } from "./chat-details";
import { Composer, groupedWith, MessageRow } from "./chat-message";
import { ChatNav, titleOf } from "./chat-nav";
import { ThreadPanel } from "./chat-thread";

// Team chat: its own sidebar of conversations (chat-nav.tsx; a drawer on a phone), the open
// conversation, and beside it the channel's details or a thread. New messages, typing and who's
// online arrive over Supabase Realtime; the messages themselves always load through the API,
// which checks who may read them.

const TYPING_MS = 4000;
const PAGE = 50;
const lastKey = (slug: string) => `zadaci:chat-last:${slug}`;

export function ChatView({
	slug,
	channelId,
	starting,
}: {
	slug: string;
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
	// the sidebar's "Pinned": open the conversation's pins (a count, so asking twice works)
	const [pinsAsked, setPinsAsked] = useState(0);
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

	const talkTo = async (memberIds: string[]) => {
		try {
			const { data: dm } = await openDm({ variables: { slug, memberIds } });
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
				drawer={drawer}
				onOpenDm={(ids) => void talkTo(ids)}
				onPins={() => setPinsAsked((n) => n + 1)}
				onClose={() => setDrawer(false)}
			/>
			{open ? (
				<Conversation
					key={open.id}
					slug={slug}
					channel={open}
					title={titleOf(open, me?.id)}
					meName={me?.name ?? ""}
					pinsAsked={pinsAsked}
					onMenu={() => setDrawer(true)}
				/>
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

/** The start of a conversation, Discord-style: what this place is. */
function Welcome({ channel, title }: { channel: ChatChannel; title: string }) {
	const dm = channel.kind === "dm";
	const self = dm && channel.people.length === 1;
	const other = dm ? channel.people.find((p) => p.name === title) : undefined;
	return (
		<div className="chat-welcome">
			{dm ? (
				<Av
					name={other?.name ?? channel.people[0]?.name ?? title}
					image={(other ?? channel.people[0])?.image}
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
			<h2>{self ? "Notes to self" : dm ? title : `Welcome to #${title}!`}</h2>
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

function Conversation({
	slug,
	channel,
	title,
	meName,
	pinsAsked,
	onMenu,
}: {
	slug: string;
	channel: ChatChannel;
	title: string;
	meName: string;
	pinsAsked: number;
	onMenu: () => void;
}) {
	const client = useApolloClient();
	const variables = { slug, channelId: channel.id };
	const { data, refetch } = useQuery(CHAT_MESSAGES, { variables });
	const [older, setOlder] = useState<ChatMessage[]>([]);
	const [noMore, setNoMore] = useState(false);
	const messages = [...older, ...(data?.chatMessages ?? [])];
	const [markRead] = useMutation(MARK_CHAT_READ, {
		refetchQueries: ["ChatChannels"],
	});
	const [favorite] = useMutation(FAVORITE_CHAT_CHANNEL, {
		refetchQueries: ["ChatChannels"],
	});
	const [typing, setTyping] = useState<Record<string, number>>({});
	// beside the conversation: the details (on Info or Pins), or a thread (by its first message's id)
	const [side, setSide] = useState<
		"details" | "pins" | { thread: string } | null
	>(null);
	useEffect(() => {
		if (pinsAsked) setSide("pins");
	}, [pinsAsked]);
	const [online, setOnline] = useState(0);
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
		void import("@supabase/realtime-js").then(({ RealtimeClient }) => {
			if (gone) return;
			// shortcut: a second socket while chat is open (LiveUpdates holds the other); share one if it matters
			const realtime = new RealtimeClient(`${config.url}/realtime/v1`, {
				params: { apikey: config.anonKey },
				...(config.private && { accessToken: realtimeToken }),
			});
			const room = realtime
				.channel(`chat:${channel.id}`, {
					config: { private: config.private, presence: { key: TAB_ID } },
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
					if (name && name !== meName)
						setTyping((t) => ({ ...t, [name]: Date.now() }));
				})
				.on("presence", { event: "sync" }, () =>
					setOnline(Object.keys(room.presenceState()).length),
				)
				.subscribe((status) => {
					if (status === "SUBSCRIBED") void room.track({ name: meName });
				});
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
		<>
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
					<span className="chat-h-ic" aria-hidden="true">
						<span
							className={cn(
								"size-4",
								channel.kind === "dm"
									? "icon-[solar--chat-round-dots-linear]"
									: channel.teamId
										? "icon-[solar--users-group-two-rounded-linear]"
										: channel.private
											? "icon-[solar--lock-keyhole-minimalistic-linear]"
											: "icon-[solar--hashtag-linear]",
							)}
						/>
					</span>
					<b className="trunc">{title}</b>
					<button
						type="button"
						className="ibtn ibtn-sm"
						aria-pressed={channel.favorite}
						aria-label={
							channel.favorite ? "Remove from Favourites" : "Add to Favourites"
						}
						data-tip={
							channel.favorite ? "Remove from Favourites" : "Add to Favourites"
						}
						onClick={() =>
							void favorite({
								variables: {
									slug,
									channelId: channel.id,
									favorite: !channel.favorite,
								},
							}).catch(() => toast.error("Couldn't update Favourites"))
						}
					>
						<span
							className={cn(
								"size-4",
								channel.favorite
									? "icon-[solar--star-bold] chat-star"
									: "icon-[solar--star-linear]",
							)}
							aria-hidden="true"
						/>
					</button>
					<span className="sp" />
					{online > 1 && (
						<span className="faint chat-online">{online} here now</span>
					)}
					<button
						type="button"
						className={cn("btn btn-secondary btn-sm", details && "on")}
						aria-pressed={details}
						onClick={() => setSide(details ? null : "details")}
					>
						<span
							className="icon-[solar--info-circle-linear] size-4"
							aria-hidden="true"
						/>
						<span className="chat-h-label">Details</span>
					</button>
				</header>
				<div className="chat-msgs" ref={list}>
					{/* the start sits at the top only once there's nothing earlier to load */}
					{data && !hasEarlier && <Welcome channel={channel} title={title} />}
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
					channelId={channel.id}
					placeholder={
						channel.kind === "dm" ? `Message ${title}` : `Message #${title}`
					}
					onTyping={() => say.current("typing", { name: meName })}
					onSent={(message) => {
						client.cache.updateQuery(
							{ query: CHAT_MESSAGES, variables },
							(prev) => ({
								chatMessages: [...(prev?.chatMessages ?? []), message],
							}),
						);
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
					onClose={() => setSide(null)}
				/>
			)}
			{thread && (
				<ThreadPanel
					key={thread.id}
					slug={slug}
					parent={thread}
					onClose={() => setSide(null)}
					onChange={() => void refetch()}
				/>
			)}
		</>
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
						disabled={busy || !name.trim()}
						onClick={() => void go()}
					>
						Create channel
					</button>
				</>
			}
		>
			<div className="modal-b chat-start">
				<>
					<input
						className="input"
						placeholder="Name, like design-reviews"
						aria-label="Channel name"
						value={name}
						maxLength={80}
						onChange={(e) => setName(e.target.value)}
					/>
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
				</>
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
