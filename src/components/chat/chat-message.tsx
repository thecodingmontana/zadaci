import { useApolloClient, useMutation } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { createContext, useContext, useRef, useState } from "react";
import { Av } from "#/components/q/av";
import { ConfirmModal } from "#/components/q/confirm";
import { EmojiPicker } from "#/components/q/emoji-picker";
import { PickPopover } from "#/components/tasks/pick";
import {
	CHAT_PINS,
	type ChatMessage,
	DELETE_CHAT_MESSAGE,
	EDIT_CHAT_MESSAGE,
	PIN_CHAT_MESSAGE,
	REACT_TO_CHAT_MESSAGE,
} from "#/graphql/chat-operations";
import { ago } from "#/lib/time";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import {
	Attachments,
	type Draft,
	DraftFiles,
	useDraftFiles,
	VoiceNote,
} from "./chat-files";

// One chat message (with its reactions, thread link and actions) and the box you write in. Used
// by the conversation and by a thread.

/** Member ids to names, for showing @mentions (the conversation provides it). */
export const ChatNamesContext = createContext({
	slug: "",
	names: new Map<string, string>(),
});

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A message's text with its @mentions marked (only the people who were picked). */
function WithMentions({ text, ids }: { text: string; ids: string[] }) {
	const { slug, names } = useContext(ChatNamesContext);
	// each picked person by name (the first pick wins if two share a name)
	const byName = new Map<string, string>();
	for (const id of ids) {
		const name = names.get(id);
		if (name && !byName.has(name)) byName.set(name, id);
	}
	// longest first, so "Sam Lee" wins over "Sam"
	const mentioned = [...byName.keys()].sort((a, b) => b.length - a.length);
	if (!mentioned.length) return text;
	const parts = text.split(
		new RegExp(`(@(?:${mentioned.map(escapeRe).join("|")}))`, "g"),
	);
	return parts.map((part, i) =>
		i % 2 ? (
			// a mention opens that person's page
			<Link
				// biome-ignore lint/suspicious/noArrayIndexKey: parts of one fixed string
				key={i}
				to="/w/$slug/members/$memberId"
				params={{ slug, memberId: byName.get(part.slice(1)) ?? "" }}
				className="chat-at"
			>
				{part}
			</Link>
		) : (
			part
		),
	);
}

/** Someone who can be @mentioned. */
export type Mentionable = { id: string; name: string; image: string | null };

/** Same author within five minutes: shown as one block, without the name again. */
export const groupedWith = (m: ChatMessage, prev: ChatMessage | undefined) =>
	!!prev &&
	prev.author?.id === m.author?.id &&
	Date.parse(m.createdAt) - Date.parse(prev.createdAt) < 5 * 60_000;

export function MessageRow({
	slug,
	message: m,
	grouped,
	onChange,
	onThread,
}: {
	slug: string;
	message: ChatMessage;
	grouped: boolean;
	onChange: () => void;
	/** open this message's thread; none inside a thread */
	onThread?: () => void;
}) {
	const [react] = useMutation(REACT_TO_CHAT_MESSAGE);
	const [edit] = useMutation(EDIT_CHAT_MESSAGE);
	const [remove] = useMutation(DELETE_CHAT_MESSAGE);
	const client = useApolloClient();
	const [pin] = useMutation(PIN_CHAT_MESSAGE, {
		refetchQueries: ["ChatPins", "ChatMessages"],
	});
	// one pinned message per conversation: pinning another asks first
	const [replacing, setReplacing] = useState(false);
	const pinIt = (pinned: boolean) =>
		pin({ variables: { slug, id: m.id, pinned } }).catch(fail("Couldn't pin"));
	const askPin = () => {
		if (m.pinned) return void pinIt(false);
		const current = client.readQuery({
			query: CHAT_PINS,
			variables: { slug, channelId: m.channelId },
		})?.chatPins[0];
		if (current && current.id !== m.id) setReplacing(true);
		else void pinIt(true);
	};
	const [picking, setPicking] = useState(false);
	const fail = (title: string) => (e: Error) =>
		toast.error(title, { desc: e.message });
	const toggle = (emoji: string) =>
		react({ variables: { slug, id: m.id, emoji } }).catch(
			fail("Couldn't react"),
		);
	const author = m.author?.name ?? "Deleted user";

	return (
		// tabIndex -1: a tap focuses the message, which shows its actions on a phone
		<div
			id={`m-${m.id}`}
			className={cn(
				"chat-msg",
				grouped && "grouped",
				m.pinned && "pinned",
				m.mentionsMe && "mentions-me",
			)}
			tabIndex={-1}
		>
			<div className="chat-av">
				{!grouped && <Av name={author} image={m.author?.image} />}
			</div>
			<div className="chat-body">
				{!grouped && (
					<div className="chat-meta">
						<b>{author}</b>
						<span className="faint">{ago(m.createdAt)}</span>
						{m.pinned && (
							<span className="chat-pin-tag">
								<span
									className="icon-[solar--pin-bold] size-3"
									aria-hidden="true"
								/>
								Pinned
							</span>
						)}
					</div>
				)}
				{m.body && (
					<div className="chat-text">
						<WithMentions text={m.body} ids={m.mentions} />
						{m.editedAt && <span className="faint chat-edited"> (edited)</span>}
					</div>
				)}
				<Attachments files={m.attachments} />
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
				{onThread && m.replyCount > 0 && (
					<button type="button" className="chat-replies" onClick={onThread}>
						<b>
							{m.replyCount} {m.replyCount === 1 ? "reply" : "replies"}
						</b>
						{m.lastReplyAt && (
							<span className="faint">Last {ago(m.lastReplyAt)}</span>
						)}
					</button>
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
				{onThread && (
					<button
						type="button"
						className="ibtn ibtn-xs"
						aria-label="Reply in thread"
						data-tip="Reply in thread"
						onClick={onThread}
					>
						<span
							className="icon-[solar--chat-line-linear] size-4"
							aria-hidden="true"
						/>
					</button>
				)}
				<button
					type="button"
					className="ibtn ibtn-xs"
					aria-label={m.pinned ? "Unpin" : "Pin"}
					data-tip={m.pinned ? "Unpin" : "Pin"}
					onClick={askPin}
				>
					<span
						className={cn(
							"size-4",
							m.pinned ? "icon-[solar--pin-bold]" : "icon-[solar--pin-linear]",
						)}
						aria-hidden="true"
					/>
				</button>
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
			<ConfirmModal
				open={replacing}
				onOpenChange={setReplacing}
				title="Replace the pinned message?"
				body="A conversation keeps one pinned message. This one will take the place of the one pinned now."
				ok="Pin this instead"
				icon="icon-[solar--pin-linear]"
				onConfirm={() => pinIt(true)}
			/>
		</div>
	);
}

/** The box you write in. It keeps what you type and the files you add; sending hands them on
 *  (useOutbox shows the message at once and uploads the files then). */
export function Composer({
	placeholder,
	people,
	onTyping,
	onSend,
}: {
	placeholder: string;
	/** who can be @mentioned here (the people who can see it, you left out) */
	people: Mentionable[];
	onTyping?: () => void;
	onSend: (body: string, files: Draft[], mentionIds: string[]) => void;
}) {
	const [text, setText] = useState("");
	const drafts = useDraftFiles();
	const [emoji, setEmoji] = useState(false);
	const [dragging, setDragging] = useState(false);
	const ref = useRef<HTMLTextAreaElement>(null);
	const picker = useRef<HTMLInputElement>(null);
	const lastTyping = useRef(0);
	const canSend = !!text.trim() || drafts.files.length > 0;
	// @mentions: the word being typed after "@", and who was picked from the list
	const [at, setAt] = useState<{ query: string; start: number } | null>(null);
	const [atIndex, setAtIndex] = useState(0);
	const picked = useRef(new Map<string, string>());
	const matches = at
		? people
				.filter((p) => p.name.toLowerCase().includes(at.query.toLowerCase()))
				.slice(0, 6)
		: [];
	const findAt = (value: string, caret: number) => {
		const m = /(^|\s)@([^\s@]{0,30})$/.exec(value.slice(0, caret));
		setAt(
			m ? { query: m[2] ?? "", start: caret - (m[2]?.length ?? 0) - 1 } : null,
		);
		setAtIndex(0);
	};
	const mention = (p: Mentionable) => {
		const el = ref.current;
		if (!at || !el) return;
		const caret = el.selectionStart ?? text.length;
		const insert = `@${p.name} `;
		setText(text.slice(0, at.start) + insert + text.slice(caret));
		picked.current.set(p.id, p.name);
		setAt(null);
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(at.start + insert.length, at.start + insert.length);
		});
	};

	const submit = () => {
		if (!canSend) return;
		const body = text.trim();
		// only picks whose @Name is still in the text
		const ids = [...picked.current]
			.filter(([, name]) => body.includes(`@${name}`))
			.map(([id]) => id);
		onSend(body, drafts.take(), ids);
		picked.current.clear();
		setText("");
		setAt(null);
		ref.current?.focus();
	};

	return (
		// files can be dropped on it or pasted into it, as well as picked with "Add file"
		// biome-ignore lint/a11y/noStaticElementInteractions: a drop target; the Add file button does the same from the keyboard
		<div
			className={cn("chat-compose", dragging && "drop")}
			onDragOver={(e) => {
				if (!e.dataTransfer.types.includes("Files")) return;
				e.preventDefault();
				setDragging(true);
			}}
			onDragLeave={() => setDragging(false)}
			onDrop={(e) => {
				if (!e.dataTransfer.files.length) return;
				e.preventDefault();
				setDragging(false);
				drafts.add([...e.dataTransfer.files]);
			}}
		>
			<DraftFiles files={drafts.files} onRemove={drafts.remove} />
			<textarea
				ref={ref}
				rows={1}
				value={text}
				aria-label={placeholder}
				placeholder={placeholder}
				maxLength={4000}
				onChange={(e) => {
					setText(e.target.value);
					findAt(
						e.target.value,
						e.target.selectionStart ?? e.target.value.length,
					);
					// tell the room you're typing, at most every few seconds
					if (onTyping && Date.now() - lastTyping.current > 2500) {
						lastTyping.current = Date.now();
						onTyping();
					}
				}}
				onPaste={(e) => {
					if (!e.clipboardData.files.length) return;
					e.preventDefault();
					drafts.add([...e.clipboardData.files]);
				}}
				onKeyDown={(e) => {
					// the @ list takes the arrow keys, Enter, Tab and Escape while it's open
					if (matches.length) {
						if (e.key === "ArrowDown" || e.key === "ArrowUp") {
							e.preventDefault();
							const step = e.key === "ArrowDown" ? 1 : -1;
							setAtIndex((i) => (i + step + matches.length) % matches.length);
							return;
						}
						if (e.key === "Enter" || e.key === "Tab") {
							e.preventDefault();
							const p = matches[atIndex];
							if (p) mention(p);
							return;
						}
						if (e.key === "Escape") {
							e.preventDefault();
							setAt(null);
							return;
						}
					}
					if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
						e.preventDefault();
						submit();
					}
				}}
				onBlur={() => setAt(null)}
				onClick={(e) =>
					findAt(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)
				}
			/>
			{matches.length > 0 && (
				<div
					className="chat-at-pop"
					role="listbox"
					aria-label="People to mention"
				>
					{matches.map((p, i) => (
						<button
							key={p.id}
							type="button"
							role="option"
							aria-selected={i === atIndex}
							className={cn("chat-at-opt", i === atIndex && "on")}
							// keep the box focused: picking happens before blur
							onMouseDown={(e) => {
								e.preventDefault();
								mention(p);
							}}
						>
							<Av name={p.name} image={p.image} className="chat-side-av" />
							<span className="trunc">{p.name}</span>
						</button>
					))}
				</div>
			)}
			<div className="chat-compose-tools">
				<input
					ref={picker}
					type="file"
					multiple
					hidden
					onChange={(e) => {
						drafts.add([...(e.target.files ?? [])]);
						e.target.value = "";
					}}
				/>
				<button
					type="button"
					className="btn btn-secondary btn-sm"
					onClick={() => picker.current?.click()}
				>
					<span
						className="icon-[solar--paperclip-linear] size-4"
						aria-hidden="true"
					/>
					<span className="chat-h-label">Add file</span>
				</button>
				<span className="sp" />
				<VoiceNote onDone={(file, seconds) => drafts.add([file], seconds)} />
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
					className="btn btn-primary btn-sm chat-send"
					data-tip="Send"
					disabled={!canSend}
					onClick={submit}
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

// a screenful of message-shaped rows: [name width, first line, second line (0: none)]
const SK_ROWS = [
	[30, 62, 40],
	[24, 78, 0],
	[36, 54, 70],
	[28, 84, 0],
	[32, 46, 58],
	[26, 70, 0],
	[38, 58, 34],
	[30, 80, 0],
	[24, 52, 66],
	[34, 74, 0],
	[28, 60, 44],
	[32, 68, 0],
] as const;

/** While messages load: rows shaped like messages, filling the conversation. */
export function MessagesSkeleton() {
	return (
		<div className="chat-sk" aria-busy="true">
			<output className="sr-only">Loading messages</output>
			{SK_ROWS.map(([name, line, more], i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of placeholders
				<div key={i} className="chat-msg" aria-hidden="true">
					<div className="chat-av">
						<span
							className="sk"
							style={{ width: 28, height: 28, borderRadius: "50%" }}
						/>
					</div>
					<div className="chat-body">
						<span className="sk" style={{ width: `${name}%`, height: 11 }} />
						<span
							className="sk"
							style={{ width: `${line}%`, height: 11, marginTop: 8 }}
						/>
						{more > 0 && (
							<span
								className="sk"
								style={{ width: `${more}%`, height: 11, marginTop: 6 }}
							/>
						)}
					</div>
				</div>
			))}
		</div>
	);
}
