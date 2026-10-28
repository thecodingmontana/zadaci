import { useMutation } from "@apollo/client/react";
import { useRef, useState } from "react";
import { Av } from "#/components/q/av";
import { EmojiPicker } from "#/components/q/emoji-picker";
import { PickPopover } from "#/components/tasks/pick";
import {
	type ChatMessage,
	DELETE_CHAT_MESSAGE,
	EDIT_CHAT_MESSAGE,
	PIN_CHAT_MESSAGE,
	REACT_TO_CHAT_MESSAGE,
	SEND_CHAT_MESSAGE,
} from "#/graphql/chat-operations";
import { ago } from "#/lib/time";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// One chat message (with its reactions, thread link and actions) and the box you write in. Used
// by the conversation and by a thread.

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
	const [pin] = useMutation(PIN_CHAT_MESSAGE, { refetchQueries: ["ChatPins"] });
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
			className={cn("chat-msg", grouped && "grouped", m.pinned && "pinned")}
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
					onClick={() =>
						void pin({
							variables: { slug, id: m.id, pinned: !m.pinned },
						}).catch(fail("Couldn't pin"))
					}
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
		</div>
	);
}

export function Composer({
	slug,
	channelId,
	parentId,
	placeholder,
	onTyping,
	onSent,
}: {
	slug: string;
	channelId: string;
	/** a reply in this thread */
	parentId?: string;
	placeholder: string;
	onTyping?: () => void;
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
			const { data } = await send({
				variables: { slug, channelId, body, parentId },
			});
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
					if (onTyping && Date.now() - lastTyping.current > 2500) {
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
