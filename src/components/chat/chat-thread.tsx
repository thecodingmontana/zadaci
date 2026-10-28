import { useApolloClient, useQuery } from "@apollo/client/react";
import { useEffect, useRef } from "react";
import { CHAT_MESSAGES, type ChatMessage } from "#/graphql/chat-operations";
import { Composer, groupedWith, MessageRow } from "./chat-message";

// A thread beside the conversation: the message it started from, its replies, and a box to reply.
// New replies arrive through the conversation's live channel, which refetches this query too.

export function ThreadPanel({
	slug,
	parent,
	onClose,
	onChange,
}: {
	slug: string;
	parent: ChatMessage;
	onClose: () => void;
	/** a reply landed: the conversation's reply counts change */
	onChange: () => void;
}) {
	const client = useApolloClient();
	const variables = { slug, channelId: parent.channelId, parentId: parent.id };
	const { data, refetch } = useQuery(CHAT_MESSAGES, { variables });
	const replies = data?.chatMessages ?? [];
	const list = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: follow new replies down
	useEffect(() => {
		const el = list.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [replies.length]);

	return (
		<aside className="chat-side chat-thread" aria-label="Thread">
			<div className="chat-side-h">
				<b>Thread</b>
				<span className="sp" />
				<button
					type="button"
					className="ibtn ibtn-sm"
					aria-label="Close thread"
					onClick={onClose}
				>
					<span
						className="icon-[solar--close-circle-linear] size-4"
						aria-hidden="true"
					/>
				</button>
			</div>
			<div className="chat-thread-msgs" ref={list}>
				<MessageRow
					slug={slug}
					message={parent}
					grouped={false}
					onChange={onClose}
				/>
				<div className="chat-thread-sep">
					<span>
						{replies.length
							? `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`
							: "No replies yet"}
					</span>
				</div>
				{replies.map((m, i) => (
					<MessageRow
						key={m.id}
						slug={slug}
						message={m}
						grouped={groupedWith(m, replies[i - 1])}
						onChange={() => {
							void refetch();
							onChange();
						}}
					/>
				))}
			</div>
			<Composer
				slug={slug}
				channelId={parent.channelId}
				parentId={parent.id}
				placeholder="Reply…"
				onSent={(message) => {
					client.cache.updateQuery(
						{ query: CHAT_MESSAGES, variables },
						(prev) => ({
							chatMessages: [...(prev?.chatMessages ?? []), message],
						}),
					);
					onChange();
				}}
			/>
		</aside>
	);
}
