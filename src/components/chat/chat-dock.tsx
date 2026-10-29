import { useMutation, useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useCloseOnOutsideClick } from "#/components/tasks/drawer";
import { CHAT_CHANNELS, OPEN_CHAT_FOR } from "#/graphql/chat-operations";
import { NOTE_PEOPLE } from "#/graphql/note-operations";
import { type ChatDockTarget, closeChatDock } from "#/lib/chat-dock";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { titleOf } from "./chat-nav";
import { Conversation, ConversationSkeleton } from "./chat-view";

// A project's or task's own chat in a side panel over the page, like Zad's: the same conversation
// as on the Chat page, or a way to start it if it has none yet.

const noop = () => {};

export function ChatDock({
	slug,
	target,
	leaving,
}: {
	slug: string;
	target: ChatDockTarget;
	/** closed, and sliding out before it unmounts */
	leaving?: boolean;
}) {
	const { data } = useQuery(CHAT_CHANNELS, { variables: { slug } });
	const people =
		useQuery(NOTE_PEOPLE, { variables: { slug } }).data?.workspace?.members ??
		[];
	const me = people.find((p) => p.isMe);
	const channels = data?.workspace?.chatChannels;
	const about = (c: { link: { kind: string; id: string } | null }) =>
		c.link?.kind === target.kind && c.link.id === target.id;
	// its own chat first; otherwise a channel someone linked to it
	const channel =
		channels?.find((c) => c.followsProject && about(c)) ??
		channels?.find(about);
	const [start, starting] = useMutation(OPEN_CHAT_FOR, {
		refetchQueries: ["ChatChannels"],
		awaitRefetchQueries: true,
	});
	const aside = useCloseOnOutsideClick(closeChatDock);
	// Esc closes it unless something is open on top, or you're writing in it
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape" || e.defaultPrevented) return;
			if (document.querySelector(".pop, [role=dialog]")) return;
			if ((e.target as Element | null)?.closest?.(".chat-drawer textarea"))
				return;
			closeChatDock();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	return (
		<aside
			ref={aside}
			className={cn("drawer enter chat-drawer", leaving && "leaving")}
			aria-label={`Chat about ${target.title}`}
		>
			<div className="drawer-h">
				<span
					className="icon-[solar--chat-round-dots-linear] size-4"
					aria-hidden="true"
				/>
				<b className="trunc" style={{ marginLeft: 4 }}>
					{target.title}
				</b>
				<span className="sp" />
				{channel && (
					<Link
						to="/w/$slug/chat"
						params={{ slug }}
						search={{ c: channel.id }}
						className="ibtn ibtn-sm"
						aria-label="Open in Chat"
						data-tip="Open in Chat"
						onClick={closeChatDock}
					>
						<span
							className="icon-[solar--square-top-down-linear] size-4"
							aria-hidden="true"
						/>
					</Link>
				)}
				<button
					type="button"
					className="ibtn ibtn-sm"
					aria-label="Close"
					data-tip="Close (Esc)"
					onClick={closeChatDock}
				>
					<span
						className="icon-[solar--close-circle-linear] size-4"
						aria-hidden="true"
					/>
				</button>
			</div>
			<div className="chat-dock">
				{!channels ? (
					<ConversationSkeleton onMenu={noop} />
				) : channel ? (
					<Conversation
						key={channel.id}
						slug={slug}
						channel={channel}
						title={titleOf(channel, me?.id)}
						me={me}
						everyone={people}
						onMenu={noop}
					/>
				) : (
					<div className="chat-dock-empty">
						<span className="chat-welcome-ic" aria-hidden="true">
							<span className="icon-[solar--chat-round-dots-linear] size-8" />
						</span>
						<h2>No chat for this {target.kind} yet</h2>
						<p className="faint">
							Start one to talk about {target.title} with everyone who can see
							the {target.kind === "task" ? "task's project" : "project"}.
						</p>
						<button
							type="button"
							className="btn btn-primary"
							disabled={starting.loading}
							onClick={() =>
								void toast
									.promise(
										start({
											variables: { slug, kind: target.kind, id: target.id },
										}),
										{
											loading: "Starting the chat…",
											success: "Chat started",
											error: "Couldn't start the chat",
										},
									)
									.catch(() => {})
							}
						>
							<span
								className={cn(
									"size-4",
									starting.loading
										? "icon-[hugeicons--loading-03] animate-spin"
										: "icon-[hugeicons--plus-sign]",
								)}
								aria-hidden="true"
							/>
							{starting.loading ? "Starting…" : "Start the chat"}
						</button>
					</div>
				)}
			</div>
		</aside>
	);
}
