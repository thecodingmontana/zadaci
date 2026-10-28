import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useOpenItem } from "#/components/ai/assistant-parts";
import { ItemPicker } from "#/components/notes/item-picker";
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
import { ago } from "#/lib/time";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { ChatNav, titleOf } from "./chat-nav";

// Team chat: the open conversation (the sidebar lists them all; chat-nav.tsx) and its details.
// New messages, typing and who's online arrive over Supabase Realtime; the messages themselves
// always load through the API, which checks who may read them.

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
	/** the sidebar's "Add channel" or "New message" */
	starting?: "channel" | "dm";
}) {
	const navigate = useNavigate();
	const { data } = useQuery(CHAT_CHANNELS, { variables: { slug } });
	const people =
		useQuery(NOTE_PEOPLE, { variables: { slug } }).data?.workspace?.members ??
		[];
	const me = people.find((p) => p.isMe);
	const channels = data?.workspace?.chatChannels ?? [];
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

	return (
		<div className="page flush chat">
			<ChatNav
				slug={slug}
				channels={data?.workspace?.chatChannels}
				openId={open?.id}
				meName={me?.name}
			/>
			{open ? (
				<Conversation
					key={open.id}
					slug={slug}
					channel={open}
					title={titleOf(open, me?.name)}
					meName={me?.name ?? ""}
				/>
			) : (
				<section className="chat-main chat-blank faint">
					{data && channelId ? "This conversation isn't here any more." : ""}
				</section>
			)}
			{starting && (
				<StartDialog
					slug={slug}
					kind={starting}
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

function Conversation({
	slug,
	channel,
	title,
	meName,
}: {
	slug: string;
	channel: ChatChannel;
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
	const [details, setDetails] = useState(false);
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
		<>
			<section className="chat-main">
				<header className="chat-h">
					<span className="chat-h-ic" aria-hidden="true">
						<span
							className={cn(
								"size-4",
								channel.kind === "dm"
									? "icon-[solar--chat-round-dots-linear]"
									: channel.private
										? "icon-[solar--lock-keyhole-minimalistic-linear]"
										: "icon-[solar--hashtag-linear]",
							)}
						/>
					</span>
					<b className="trunc">{title}</b>
					<span className="sp" />
					{online > 1 && (
						<span className="faint chat-online">{online} here now</span>
					)}
					{channel.kind === "channel" && (
						<button
							type="button"
							className={cn("btn btn-secondary btn-sm", details && "on")}
							aria-pressed={details}
							onClick={() => setDetails((d) => !d)}
						>
							<span
								className="icon-[solar--info-circle-linear] size-4"
								aria-hidden="true"
							/>
							Details
						</button>
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
					placeholder="Write a message…"
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
					slug={slug}
					channel={channel}
					onClose={() => setDetails(false)}
				/>
			)}
		</>
	);
}

function ChannelDetails({
	slug,
	channel,
	onClose,
}: {
	slug: string;
	channel: ChatChannel;
	onClose: () => void;
}) {
	const openItem = useOpenItem(slug);
	const [allUsers, setAllUsers] = useState(false);
	const users = allUsers ? channel.people : channel.people.slice(0, 6);
	const created = new Date(channel.createdAt).toLocaleDateString([], {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
	const link = channel.link;
	return (
		<aside className="chat-details" aria-label="Channel details">
			<div className="chat-details-h">
				<b>Details</b>
				<span className="sp" />
				<button
					type="button"
					className="ibtn ibtn-sm"
					aria-label="Close details"
					onClick={onClose}
				>
					<span
						className="icon-[solar--close-circle-linear] size-4"
						aria-hidden="true"
					/>
				</button>
			</div>
			<h3 className="chat-details-t">Main info</h3>
			<dl className="chat-info">
				<div>
					<dt>
						<span
							className="icon-[solar--user-linear] size-4"
							aria-hidden="true"
						/>
						Creator
					</dt>
					<dd>
						{channel.creator ? (
							<>
								<Av name={channel.creator.name} image={channel.creator.image} />
								<span className="trunc">{channel.creator.name}</span>
							</>
						) : (
							"Zadaci"
						)}
					</dd>
				</div>
				<div>
					<dt>
						<span
							className="icon-[solar--calendar-linear] size-4"
							aria-hidden="true"
						/>
						Created
					</dt>
					<dd>{created}</dd>
				</div>
				<div>
					<dt>
						<span
							className={cn(
								"size-4",
								channel.private
									? "icon-[solar--lock-keyhole-minimalistic-linear]"
									: "icon-[solar--hashtag-linear]",
							)}
							aria-hidden="true"
						/>
						Access
					</dt>
					<dd>{channel.private ? "Members only" : "Everyone"}</dd>
				</div>
				{link && (
					<div>
						<dt>
							<span
								className={cn(
									"size-4",
									link.kind === "task"
										? "icon-[solar--checklist-minimalistic-linear]"
										: "icon-[solar--folder-linear]",
								)}
								aria-hidden="true"
							/>
							{link.kind === "task" ? "Task" : "Project"}
						</dt>
						<dd>
							<button
								type="button"
								className="chat-link"
								onClick={() =>
									void openItem({
										kind: link.kind,
										id: link.id,
										label: link.title,
									})
								}
							>
								<span className="trunc">{link.title}</span>
								<span
									className="icon-[solar--alt-arrow-right-linear] size-4"
									aria-hidden="true"
								/>
							</button>
						</dd>
					</div>
				)}
			</dl>
			{channel.topic && (
				<>
					<h3 className="chat-details-t">Topic</h3>
					<p className="chat-details-topic">{channel.topic}</p>
				</>
			)}
			<h3 className="chat-details-t">
				Users <span className="chat-count">{channel.people.length}</span>
			</h3>
			<div className="chat-users">
				{users.map((p) => (
					<div key={p.id} className="chat-user">
						<Av name={p.name} image={p.image} className="chat-user-av" />
						<span className="trunc">{p.name}</span>
					</div>
				))}
			</div>
			{channel.people.length > 6 && (
				<button
					type="button"
					className="btn btn-secondary btn-sm chat-all"
					onClick={() => setAllUsers((a) => !a)}
				>
					<span
						className="icon-[solar--users-group-rounded-linear] size-4"
						aria-hidden="true"
					/>
					{allUsers ? "Show fewer" : "Show all users"}
				</button>
			)}
		</aside>
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
	const time = ago(m.createdAt);

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
			<div className="chat-compose-tools">
				<span className="sp" />
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
					className="chat-send"
					data-tip="Send"
					disabled={!text.trim() || loading}
					onClick={() => void submit()}
					aria-label="Send"
				>
					<span
						className="icon-[solar--arrow-up-linear] size-4"
						aria-hidden="true"
					/>
				</button>
			</div>
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
	const [topic, setTopic] = useState("");
	const [linkKind, setLinkKind] = useState<"none" | "project" | "task">("none");
	const [link, setLink] = useState<{ id: string; name: string } | null>(null);
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
									topic: topic.trim() || undefined,
									private: isPrivate,
									memberIds: picked,
									projectId: linkKind === "project" ? link?.id : undefined,
									taskId: linkKind === "task" ? link?.id : undefined,
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
						{linkKind !== "none" &&
							(link ? (
								<div className="chat-linked">
									<span
										className={cn(
											"size-4",
											linkKind === "task"
												? "icon-[solar--checklist-minimalistic-linear]"
												: "icon-[solar--folder-linear]",
										)}
										aria-hidden="true"
									/>
									<span className="grow trunc">{link.name}</span>
									<button
										type="button"
										className="ibtn ibtn-xs"
										aria-label="Pick another"
										onClick={() => setLink(null)}
									>
										<span
											className="icon-[solar--close-circle-linear] size-4"
											aria-hidden="true"
										/>
									</button>
								</div>
							) : (
								<ItemPicker
									slug={slug}
									kind={linkKind}
									placeholder={
										linkKind === "task" ? "Find a task…" : "Find a project…"
									}
									hint="Or paste its link."
									onPick={(id, pickedName) => {
										setLink({ id, name: pickedName });
										if (!name.trim()) setName(pickedName);
									}}
								/>
							))}
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
