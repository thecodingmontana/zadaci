import { useApolloClient } from "@apollo/client/react";
import { useEffect, useRef, useState } from "react";
import { Av } from "#/components/q/av";
import {
	type ChatAttachment,
	type ChatMessage,
	type ChatShare,
	SEND_CHAT_MESSAGE,
} from "#/graphql/chat-operations";
import { cn } from "#/lib/utils";
import { type Draft, FileThumb, uploadChatFile } from "./chat-files";

// Sending, optimistically: a message shows the moment you press send, its files upload only then,
// and once the server has it the real message takes its place.
//
// Order: messages are saved strictly one at a time, in the order you sent them (files upload in
// parallel, but a message waits for the one before it), so everyone sees them as you sent them.
// If one fails, the ones after it wait; Retry carries on from it, Discard skips it.

export type Item = {
	id: string;
	body: string;
	files: Draft[];
	/** people picked from the @ list */
	mentionIds: string[];
	/** tasks, projects, notes or bookmarks shared (named, for showing it on its way) */
	shares: (ChatShare & { name?: string })[];
	/** files already uploaded (kept, so a retry doesn't upload them again) */
	uploaded: (ChatAttachment | undefined)[];
	/** upload progress across its files, 0–100 */
	pct: number;
	/** its files are all up (or it has none) */
	ready: boolean;
	saving: boolean;
	/** why it failed, in the server's words */
	failed?: string;
};

export function useOutbox({
	slug,
	channelId,
	parentId,
	onSent,
}: {
	slug: string;
	channelId: string;
	/** a thread's replies */
	parentId?: string;
	/** the server has it: put it in the conversation */
	onSent: (message: ChatMessage) => void;
}) {
	const client = useApolloClient();
	// the queue itself lives in a ref (one source of truth for the order); state is its picture
	const queue = useRef<Item[]>([]);
	const [items, setItems] = useState<Item[]>([]);
	const busy = useRef(false);
	const sent = useRef(onSent);
	sent.current = onSent;
	const show = () => setItems([...queue.current]);
	const patch = (id: string, change: Partial<Item>) => {
		queue.current = queue.current.map((i) =>
			i.id === id ? { ...i, ...change } : i,
		);
		show();
	};
	const find = (id: string) => queue.current.find((i) => i.id === id);
	const drop = (id: string) => {
		for (const f of find(id)?.files ?? [])
			if (f.preview) URL.revokeObjectURL(f.preview);
		queue.current = queue.current.filter((i) => i.id !== id);
		show();
	};
	// leaving: free the pictures' previews
	useEffect(
		() => () => {
			for (const i of queue.current)
				for (const f of i.files) if (f.preview) URL.revokeObjectURL(f.preview);
		},
		[],
	);

	/** Uploads whatever of a message's files isn't up yet. */
	const upload = async (id: string) => {
		const item = find(id);
		if (!item) return;
		const uploaded = [...item.uploaded];
		const progress: number[] = item.files.map((_, n) =>
			uploaded[n] ? 100 : 0,
		);
		try {
			await Promise.all(
				item.files.map(async (f, n) => {
					if (uploaded[n]) return;
					uploaded[n] = await uploadChatFile(
						client,
						slug,
						channelId,
						f,
						(pct) => {
							progress[n] = pct;
							patch(id, {
								pct: Math.round(
									progress.reduce((a, b) => a + b, 0) / progress.length,
								),
							});
						},
					);
					patch(id, { uploaded: [...uploaded] });
				}),
			);
			if (find(id)) patch(id, { ready: true });
		} catch (e) {
			if (find(id)) patch(id, { failed: (e as Error).message });
		}
		pump();
	};

	/** Saves the first message in the queue once it's ready, then the next, and so on. */
	const pump = async () => {
		if (busy.current) return;
		const head = queue.current[0];
		// nothing to send, the first one failed (the rest wait for it), or its files are still going
		if (!head || head.failed || !head.ready) return;
		busy.current = true;
		patch(head.id, { saving: true });
		try {
			const attachments = head.uploaded.flatMap((a) =>
				a
					? [
							{
								url: a.url,
								name: a.name,
								size: a.size,
								type: a.type,
								...(a.seconds != null && { seconds: a.seconds }),
							},
						]
					: [],
			);
			const { data } = await client.mutate({
				mutation: SEND_CHAT_MESSAGE,
				variables: {
					slug,
					channelId,
					body: head.body,
					parentId,
					attachments,
					mentionIds: head.mentionIds,
					shares: head.shares.map(({ kind, id }) => ({ kind, id })),
				},
			});
			if (!data) throw new Error("No reply from the server");
			sent.current(data.sendChatMessage);
			drop(head.id);
		} catch (e) {
			patch(head.id, { saving: false, failed: (e as Error).message });
		} finally {
			busy.current = false;
		}
		void pump();
	};

	return {
		items,
		send: (
			body: string,
			files: Draft[],
			mentionIds: string[] = [],
			shares: (ChatShare & { name?: string })[] = [],
		) => {
			const item: Item = {
				id: crypto.randomUUID(),
				body,
				files,
				mentionIds,
				shares,
				uploaded: [],
				pct: 0,
				ready: files.length === 0,
				saving: false,
			};
			queue.current = [...queue.current, item];
			show();
			if (files.length) void upload(item.id);
			else void pump();
		},
		retry: (id: string) => {
			const item = find(id);
			if (!item) return;
			patch(id, { failed: undefined });
			// files that didn't make it go up again; the rest are kept
			if (!item.ready) void upload(id);
			else void pump();
		},
		discard: (id: string) => {
			drop(id);
			void pump();
		},
	};
}

/** A message on its way: shown as yours straight away, with how it's going. */
export function OutboxRow({
	item,
	me,
	waiting,
	onRetry,
	onDiscard,
}: {
	item: Item;
	me: { name: string; image: string | null } | undefined;
	/** a message before it failed: this one waits its turn */
	waiting: boolean;
	onRetry: () => void;
	onDiscard: () => void;
}) {
	const failed = !!item.failed;
	const uploading = !item.ready && !failed;
	return (
		<div className={cn("chat-msg chat-out", failed && "failed")}>
			<div className="chat-av">
				<Av name={me?.name ?? "You"} image={me?.image} />
			</div>
			<div className="chat-body">
				<div className="chat-meta">
					<b>{me?.name ?? "You"}</b>
				</div>
				{item.body && <div className="chat-text">{item.body}</div>}
				{item.shares.length > 0 && (
					<div className="chat-pending">
						{item.shares.map((s) => (
							<div key={`${s.kind}-${s.id}`} className="chat-pending-file">
								<span className="chat-pending-name">
									<span className="trunc">{s.name ?? s.kind}</span>
								</span>
							</div>
						))}
					</div>
				)}
				{item.files.length > 0 && (
					<div className="chat-pending">
						{item.files.map((f) => (
							<div key={f.id} className="chat-pending-file">
								<FileThumb draft={f} />
								<span className="chat-pending-name">
									<span className="trunc">{f.file.name}</span>
								</span>
							</div>
						))}
					</div>
				)}
				<output className="chat-out-state">
					{failed ? (
						<>
							<span className="chat-out-failed">
								Couldn't send{item.failed ? `: ${item.failed}` : "."}
							</span>
							<button type="button" className="chat-out-act" onClick={onRetry}>
								Retry
							</button>
							<button
								type="button"
								className="chat-out-act"
								onClick={onDiscard}
							>
								Discard
							</button>
						</>
					) : uploading ? (
						`Uploading ${item.pct}%…`
					) : waiting ? (
						"Waiting for the message before it…"
					) : (
						"Sending…"
					)}
				</output>
			</div>
		</div>
	);
}
