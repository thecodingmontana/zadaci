import { useApolloClient, useQuery } from "@apollo/client/react";
import { useEffect, useRef } from "react";
import { CHAT_MESSAGES, type ChatMessage } from "#/graphql/chat-operations";
import {
	Composer,
	groupedWith,
	type Mentionable,
	MessageRow,
	MessagesSkeleton,
} from "./chat-message";
import { OutboxRow, useOutbox } from "./chat-outbox";

// A thread beside the conversation: the message it started from, its replies, and a box to reply.
// New replies arrive through the conversation's live channel, which refetches this query too.

export function ThreadPanel({
	slug,
	parent,
	me,
	people,
	onClose,
	onChange,
}: {
	slug: string;
	parent: ChatMessage;
	me: { name: string; image: string | null } | undefined;
	/** who can be @mentioned in it */
	people: Mentionable[];
	onClose: () => void;
	/** a reply landed: the conversation's reply counts change */
	onChange: () => void;
}) {
	const client = useApolloClient();
	const variables = { slug, channelId: parent.channelId, parentId: parent.id };
	const { data, refetch } = useQuery(CHAT_MESSAGES, { variables });
	const replies = data?.chatMessages ?? [];
	const outbox = useOutbox({
		slug,
		channelId: parent.channelId,
		parentId: parent.id,
		onSent: (message) => {
			client.cache.updateQuery({ query: CHAT_MESSAGES, variables }, (prev) =>
				prev?.chatMessages.some((m) => m.id === message.id)
					? prev
					: { chatMessages: [...(prev?.chatMessages ?? []), message] },
			);
			onChange();
		},
	});
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
				{!data && <MessagesSkeleton />}
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
				{outbox.items.map((item) => (
					<OutboxRow
						key={item.id}
						item={item}
						me={me}
						onRetry={() => outbox.retry(item.id)}
						onDiscard={() => outbox.discard(item.id)}
					/>
				))}
			</div>
			<Composer
				placeholder="Reply…"
				people={people}
				onSend={(body, files, mentionIds) =>
					outbox.send(body, files, mentionIds)
				}
			/>
		</aside>
	);
}
