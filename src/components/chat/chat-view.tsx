import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Av } from "#/components/q/av";
import { EmojiPicker } from "#/components/q/emoji-picker";
import { Modal } from "#/components/q/modal";
import { realtimeToken } from "#/components/shell/live-updates";
import { PickPopover } from "#/components/tasks/pick";
import {
	CHAT_CHANNELS,
	CHAT_MESSAGES,
	type ChatChannel,
	type ChatMessage,
	CREATE_CHAT_CHANNEL,
	DELETE_CHAT_MESSAGE,
	EDIT_CHAT_MESSAGE,
	MARK_CHAT_READ,
	OPEN_CHAT_DM,
	REACT_TO_CHAT_MESSAGE,
	SEND_CHAT_MESSAGE,
} from "#/graphql/chat-operations";
import { NOTE_PEOPLE } from "#/graphql/note-operations";
import { REALTIME_CONFIG } from "#/graphql/operations";
import { TAB_ID } from "#/lib/tab";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// Team chat: the conversation list on the left, the open one on the right (one at a time on a
// phone). New messages, typing and who's online arrive over Supabase Realtime; the messages
// themselves always load through the API, which checks who may read them.

const TYPING_MS = 4000;
const PAGE = 50;

const titleOf = (c: ChatChannel, meName: string | undefined) =>
	c.kind === "dm"
		? c.people
				.filter((p) => p.name !== meName)
				.map((p) => p.name)
				.join(", ") || "Just you"
		: `#${c.name}`;

export function ChatView({
	slug,
	channelId,
}: {
	slug: string;
	channelId?: string;
}) {
	const { data } = useQuery(CHAT_CHANNELS, { variables: { slug } });
	const people =
		useQuery(NOTE_PEOPLE, { variables: { slug } }).data?.workspace?.members ??
		[];
	const me = people.find((p) => p.isMe);
	const channels = data?.workspace?.chatChannels ?? [];
	const open = channels.find((c) => c.id === channelId);
	const [starting, setStarting] = useState<"channel" | "dm" | null>(null);

	return (
		<div className={cn("page flush chat", open && "has-open")}>
			<aside className="chat-list" aria-label="Conversations">
				<div className="chat-list-h">
					<b>Chat</b>
					<span className="sp" />
					<button
						type="button"
						className="ibtn ibtn-sm"
						aria-label="New channel"
						data-tip="New channel"
						onClick={() => setStarting("channel")}
					>
						<span
							className="icon-[solar--hashtag-linear] size-4"
							aria-hidden="true"
						/>
					</button>
					<button
						type="button"
						className="ibtn ibtn-sm"
						aria-label="New message"
						data-tip="New message"
						onClick={() => setStarting("dm")}
					>
						<span
							className="icon-[solar--pen-new-square-linear] size-4"
							aria-hidden="true"
						/>
					</button>
				</div>
				{(["channel", "dm"] as const).map((kind) => (
					<div key={kind}>
						<div className="mh">
							{kind === "channel" ? "Channels" : "Direct messages"}
						</div>
						{channels
							.filter((c) => c.kind === kind)
							.map((c) => (
								<Link
									key={c.id}
									to="/w/$slug/chat"
									params={{ slug }}
									search={{ c: c.id }}
									className={cn(
										"chat-item",
										c.id === channelId && "on",
										c.unread > 0 && "unread",
									)}
								>
									<span
										className={cn(
											"size-4 shrink-0",
											c.kind === "dm"
												? "icon-[solar--chat-round-dots-linear]"
												: c.private
													? "icon-[solar--lock-keyhole-minimalistic-linear]"
													: "icon-[solar--hashtag-linear]",
										)}
										aria-hidden="true"
									/>
									<span className="grow trunc">
										{titleOf(c, me?.name).replace(/^#/, "")}
									</span>
									{c.unread > 0 && (
										<span className="chat-badge">{c.unread}</span>
									)}
								</Link>
							))}
					</div>
				))}
				{!channels.length && data && (
					<p className="faint chat-empty">
						No conversations yet. Start a channel for the team, or message
						someone.
					</p>
				)}
			</aside>
			{open ? (
				<Conversation
					key={open.id}
					slug={slug}
					channel={open}
					workspaceId={data?.workspace?.id ?? ""}
					title={titleOf(open, me?.name)}
					meName={me?.name ?? ""}
				/>
			) : (
				<section className="chat-main chat-blank faint">
					Pick a conversation, or start one.
				</section>
			)}
			{starting && (
				<StartDialog
					slug={slug}
					kind={starting}
					people={people.filter((p) => !p.isMe)}
					onClose={() => setStarting(null)}
				/>
			)}
		</div>
	);
}

function Conversation({
	slug,
	channel,
	workspaceId,
	title,
	meName,
}: {
	slug: string;
	channel: ChatChannel;
	workspaceId: string;
	title: string;
	meName: string;
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
	const [typing, setTyping] = useState<Record<string, number>>({});
	const [online, setOnline] = useState(0);
	const say = useRef<(event: string, payload: object) => void>(() => {});
	const list = useRef<HTMLDivElement>(null);
	const config = useQuery(REALTIME_CONFIG, { fetchPolicy: "cache-first" }).data
		?.realtime;

	// opening it, and each new message while it's open, marks it read
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-run as messages arrive
	useEffect(() => {
		void markRead({ variables }).catch(() => {});
	}, [data?.chatMessages.length]);

	// stay at the newest message when you're already near the bottom
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-run as messages arrive
	useEffect(() => {
		const el = list.current;
		if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160)
			el.scrollTop = el.scrollHeight;
	}, [messages.length]);

	// live: new messages, typing and who's here, on this conversation's private channel
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
				.on("broadcast", { event: "message" }, () => void refetch())
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
			// another conversation got a message: refresh the unread counts
			const others = realtime
				.channel(`ws:${workspaceId}`, { config: { private: config.private } })
				.on("broadcast", { event: "chat" }, () =>
					client.refetchQueries({ include: ["ChatChannels"] }),
				)
				.subscribe();
			say.current = (event, payload) =>
				void room.send({ type: "broadcast", event, payload });
			stop = () => {
				void realtime.removeChannel(room);
				void realtime.removeChannel(others);
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

	const loadOlder = async () => {
		const first = messages[0];
		if (!first) return;
		try {
			const { data: page } = await client.query({
				query: CHAT_MESSAGES,
				variables: { ...variables, before: first.createdAt },
				fetchPolicy: "network-only",
			});
			const rows = page?.chatMessages ?? [];
			if (rows.length < PAGE) setNoMore(true);
			setOlder((o) => [...rows, ...o]);
		} catch (e) {
			toast.error("Couldn't load earlier messages", {
				desc: (e as Error).message,
			});
		}
	};
	const typers = Object.keys(typing);

	return (
		<section className="chat-main">
			<header className="chat-h">
				<Link
					to="/w/$slug/chat"
					params={{ slug }}
					className="ibtn ibtn-sm chat-back"
					aria-label="All conversations"
				>
					<span
						className="icon-[solar--arrow-left-linear] size-4"
						aria-hidden="true"
					/>
				</Link>
				<b className="trunc">{title}</b>
				{channel.topic && (
					<span className="faint trunc chat-topic">{channel.topic}</span>
				)}
				<span className="sp" />
				{online > 1 && (
					<span className="faint chat-online">{online} here now</span>
				)}
			</header>
			<div className="chat-msgs" ref={list}>
				{(data?.chatMessages.length ?? 0) >= PAGE && !noMore && (
					<button
						type="button"
						className="btn btn-ghost btn-sm chat-older"
						onClick={() => void loadOlder()}
					>
						Load earlier messages
					</button>
				)}
				{data && !messages.length && (
					<p className="faint chat-empty">No messages yet. Say hello.</p>
				)}
				{messages.map((m, i) => {
					const prev = messages[i - 1];
					return (
						<MessageRow
							key={m.id}
							slug={slug}
							message={m}
							grouped={
								!!prev &&
								prev.author?.id === m.author?.id &&
								Date.parse(m.createdAt) - Date.parse(prev.createdAt) <
									5 * 60_000
							}
							onChange={() => void refetch()}
						/>
					);
				})}
			</div>
			<div className="chat-typing faint" aria-live="polite">
				{typers.length
					? `${typers.join(", ")} ${typers.length > 1 ? "are" : "is"} typing…`
					: ""}
			</div>
			<Composer
				slug={slug}
				channelId={channel.id}
				placeholder={`Message ${title}`}
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
	);
}

function MessageRow({
	slug,
	message: m,
	grouped,
	onChange,
}: {
	slug: string;
	message: ChatMessage;
	grouped: boolean;
	onChange: () => void;
}) {
	const [react] = useMutation(REACT_TO_CHAT_MESSAGE);
	const [edit] = useMutation(EDIT_CHAT_MESSAGE);
	const [remove] = useMutation(DELETE_CHAT_MESSAGE);
	const [picking, setPicking] = useState(false);
	const fail = (title: string) => (e: Error) =>
		toast.error(title, { desc: e.message });
	const toggle = (emoji: string) =>
		react({ variables: { slug, id: m.id, emoji } }).catch(
			fail("Couldn't react"),
		);
	const author = m.author?.name ?? "Deleted user";
	const time = new Date(m.createdAt).toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
	});

	return (
		<div className={cn("chat-msg", grouped && "grouped")}>
			<div className="chat-av">
				{!grouped && <Av name={author} image={m.author?.image} />}
			</div>
			<div className="chat-body">
				{!grouped && (
					<div className="chat-meta">
						<b>{author}</b>
						<span className="faint">{time}</span>
					</div>
				)}
				<div className="chat-text">
					{m.body}
					{m.editedAt && <span className="faint chat-edited"> (edited)</span>}
				</div>
				{m.reactions.length > 0 && (
					<div className="reacts">
						{m.reactions.map((r) => (
							<button
								key={r.emoji}
								type="button"
								className={cn("react", r.mine && "mine")}
								aria-label={`${r.emoji} ${r.count}`}
								data-tip={r.names.join(", ")}
								onClick={() => void toggle(r.emoji)}
							>
								{r.emoji}
								<span className="num">{r.count}</span>
							</button>
						))}
					</div>
				)}
			</div>
			<div className="chat-acts">
				<PickPopover
					open={picking}
					onOpenChange={setPicking}
					width={300}
					align="end"
					trigger={
						<button
							type="button"
							className="ibtn ibtn-xs"
							aria-label="React"
							data-tip="React"
						>
							<span
								className="icon-[solar--smile-circle-linear] size-4"
								aria-hidden="true"
							/>
						</button>
					}
				>
					<EmojiPicker
						onPick={(e) => {
							setPicking(false);
							void toggle(e);
						}}
					/>
				</PickPopover>
				{m.mine && (
					<>
						<button
							type="button"
							className="ibtn ibtn-xs"
							aria-label="Edit"
							data-tip="Edit"
							onClick={() => {
								// shortcut: the browser's prompt for editing; an inline editor if people edit often
								const next = window.prompt("Edit message", m.body);
								if (next?.trim() && next !== m.body)
									void edit({
										variables: { slug, id: m.id, body: next },
									}).catch(fail("Couldn't edit"));
							}}
						>
							<span
								className="icon-[solar--pen-linear] size-4"
								aria-hidden="true"
							/>
						</button>
						<button
							type="button"
							className="ibtn ibtn-xs"
							aria-label="Delete"
							data-tip="Delete"
							onClick={() => {
								if (window.confirm("Delete this message?"))
									void remove({ variables: { slug, id: m.id } }).then(
										onChange,
										fail("Couldn't delete"),
									);
							}}
						>
							<span
								className="icon-[solar--trash-bin-trash-linear] size-4"
								aria-hidden="true"
							/>
						</button>
					</>
				)}
			</div>
		</div>
	);
}

function Composer({
	slug,
	channelId,
	placeholder,
	onTyping,
	onSent,
}: {
	slug: string;
	channelId: string;
	placeholder: string;
	onTyping: () => void;
	onSent: (message: ChatMessage) => void;
}) {
	const [text, setText] = useState("");
	const [send, { loading }] = useMutation(SEND_CHAT_MESSAGE);
	const [emoji, setEmoji] = useState(false);
	const ref = useRef<HTMLTextAreaElement>(null);
	const lastTyping = useRef(0);

	const submit = async () => {
		const body = text.trim();
		if (!body || loading) return;
		setText("");
		try {
			const { data } = await send({ variables: { slug, channelId, body } });
			if (data) onSent(data.sendChatMessage);
		} catch (e) {
			setText(body);
			toast.error("Couldn't send", { desc: (e as Error).message });
		}
		ref.current?.focus();
	};

	return (
		<div className="chat-compose">
			<textarea
				ref={ref}
				rows={1}
				value={text}
				aria-label={placeholder}
				placeholder={placeholder}
				maxLength={4000}
				onChange={(e) => {
					setText(e.target.value);
					// tell the room you're typing, at most every few seconds
					if (Date.now() - lastTyping.current > 2500) {
						lastTyping.current = Date.now();
						onTyping();
					}
				}}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
						e.preventDefault();
						void submit();
					}
				}}
			/>
			<PickPopover
				open={emoji}
				onOpenChange={setEmoji}
				width={300}
				align="end"
				trigger={
					<button
						type="button"
						className="ibtn ibtn-sm"
						aria-label="Add an emoji"
						data-tip="Emoji"
					>
						<span
							className="icon-[solar--smile-circle-linear] size-4"
							aria-hidden="true"
						/>
					</button>
				}
			>
				<EmojiPicker
					onPick={(e) => {
						const at = ref.current?.selectionStart ?? text.length;
						setText(text.slice(0, at) + e + text.slice(at));
						setEmoji(false);
						requestAnimationFrame(() => ref.current?.focus());
					}}
				/>
			</PickPopover>
			<button
				type="button"
				className="btn btn-primary btn-sm"
				disabled={!text.trim() || loading}
				onClick={() => void submit()}
				aria-label="Send"
			>
				<span
					className="icon-[solar--plain-linear] size-4"
					aria-hidden="true"
				/>
			</button>
		</div>
	);
}

function StartDialog({
	slug,
	kind,
	people,
	onClose,
}: {
	slug: string;
	kind: "channel" | "dm";
	people: { id: string; name: string; image: string | null }[];
	onClose: () => void;
}) {
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [isPrivate, setPrivate] = useState(false);
	const [picked, setPicked] = useState<string[]>([]);
	const [create, creating] = useMutation(CREATE_CHAT_CHANNEL, {
		refetchQueries: ["ChatChannels"],
	});
	const [dm, opening] = useMutation(OPEN_CHAT_DM, {
		refetchQueries: ["ChatChannels"],
	});
	const busy = creating.loading || opening.loading;

	const go = async () => {
		try {
			const id =
				kind === "channel"
					? (
							await create({
								variables: {
									slug,
									name,
									private: isPrivate,
									memberIds: picked,
								},
							})
						).data?.createChatChannel.id
					: (await dm({ variables: { slug, memberIds: picked } })).data
							?.openChatDm.id;
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
			title={kind === "channel" ? "New channel" : "New message"}
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
						disabled={
							busy || (kind === "channel" ? !name.trim() : !picked.length)
						}
						onClick={() => void go()}
					>
						{kind === "channel" ? "Create channel" : "Start conversation"}
					</button>
				</>
			}
		>
			<div className="modal-b chat-start">
				{kind === "channel" && (
					<>
						<input
							className="input"
							placeholder="Name, like design-reviews"
							aria-label="Channel name"
							value={name}
							maxLength={80}
							onChange={(e) => setName(e.target.value)}
						/>
						<label className="row chat-check">
							<input
								type="checkbox"
								checked={isPrivate}
								onChange={(e) => setPrivate(e.target.checked)}
							/>
							Private: only the people you add can see it
						</label>
					</>
				)}
				{(kind === "dm" || isPrivate) && (
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
