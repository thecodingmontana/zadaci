import { useApolloClient } from "@apollo/client/react";
import { useEffect, useRef, useState } from "react";
import { Av } from "#/components/q/av";
import {
	type ChatAttachment,
	type ChatMessage,
	SEND_CHAT_MESSAGE,
} from "#/graphql/chat-operations";
import { cn } from "#/lib/utils";
import { type Draft, FileThumb, uploadChatFile } from "./chat-files";

// Sending, optimistically: a message shows the moment you press send ("Sending…"), its files
// upload only then, and once the server has it the real message takes its place. If it fails it
// stays, with Retry and Discard.

type Item = {
	id: string;
	body: string;
	files: Draft[];
	/** people picked from the @ list */
	mentionIds: string[];
	status: "sending" | "failed";
	/** why it failed, in the server's words */
	error?: string;
	/** upload progress across its files, 0–100 */
	pct: number;
	/** files already uploaded, kept so a retry doesn't send them again */
	uploaded: (ChatAttachment | undefined)[];
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
	const [items, setItems] = useState<Item[]>([]);
	const latest = useRef(items);
	latest.current = items;
	const sent = useRef(onSent);
	sent.current = onSent;
	// leaving: free the pictures' previews
	useEffect(
		() => () => {
			for (const i of latest.current)
				for (const f of i.files) if (f.preview) URL.revokeObjectURL(f.preview);
		},
		[],
	);
	const patch = (id: string, change: Partial<Item>) =>
		setItems((all) => all.map((i) => (i.id === id ? { ...i, ...change } : i)));

	const run = async (item: Item) => {
		patch(item.id, { status: "sending", error: undefined });
		try {
			const uploaded = [...item.uploaded];
			const progress: number[] = item.files.map((_, n) =>
				uploaded[n] ? 100 : 0,
			);
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
							patch(item.id, {
								pct: Math.round(
									progress.reduce((a, b) => a + b, 0) / progress.length,
								),
							});
						},
					);
					patch(item.id, { uploaded: [...uploaded] });
				}),
			);
			const attachments = uploaded.flatMap((a) =>
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
					body: item.body,
					parentId,
					attachments,
					mentionIds: item.mentionIds,
				},
			});
			if (!data) throw new Error("No reply from the server");
			sent.current(data.sendChatMessage);
			for (const f of item.files) if (f.preview) URL.revokeObjectURL(f.preview);
			setItems((all) => all.filter((i) => i.id !== item.id));
		} catch (e) {
			patch(item.id, { status: "failed", error: (e as Error).message });
		}
	};

	return {
		items,
		send: (body: string, files: Draft[], mentionIds: string[] = []) => {
			const item: Item = {
				id: crypto.randomUUID(),
				body,
				files,
				mentionIds,
				status: "sending",
				pct: 0,
				uploaded: [],
			};
			setItems((all) => [...all, item]);
			void run(item);
		},
		retry: (id: string) => {
			const item = latest.current.find((i) => i.id === id);
			if (item) void run(item);
		},
		discard: (id: string) =>
			setItems((all) => {
				const item = all.find((i) => i.id === id);
				for (const f of item?.files ?? [])
					if (f.preview) URL.revokeObjectURL(f.preview);
				return all.filter((i) => i.id !== id);
			}),
	};
}

/** A message on its way: shown as yours straight away, with how it's going. */
export function OutboxRow({
	item,
	me,
	onRetry,
	onDiscard,
}: {
	item: Item;
	me: { name: string; image: string | null } | undefined;
	onRetry: () => void;
	onDiscard: () => void;
}) {
	const failed = item.status === "failed";
	const uploading = item.files.length > 0 && item.pct < 100 && !failed;
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
								Couldn't send{item.error ? `: ${item.error}` : "."}
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
					) : (
						"Sending…"
					)}
				</output>
			</div>
		</div>
	);
}
