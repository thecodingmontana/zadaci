import { useQuery } from "@apollo/client/react";
import { useState } from "react";
import { useOpenItem } from "#/components/ai/assistant-parts";
import { Av } from "#/components/q/av";
import { CHAT_PINS, type ChatChannel } from "#/graphql/chat-operations";
import { ago } from "#/lib/time";
import { cn } from "#/lib/utils";

// A channel's details beside the conversation: who made it and what it's about (Info), and its
// pinned messages (Pins).

const SHOWN_USERS = 6;

export function ChannelDetails({
	slug,
	channel,
	tab: first = "info",
	onClose,
}: {
	slug: string;
	channel: ChatChannel;
	/** the tab it opens on */
	tab?: "info" | "pins";
	onClose: () => void;
}) {
	const [tab, setTab] = useState(first);
	return (
		<aside className="chat-side" aria-label="Details">
			<div className="chat-side-h">
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
			<div className="seg chat-tabs">
				{(
					[
						["info", "Info"],
						["pins", "Pins"],
					] as const
				).map(([k, label]) => (
					<button
						key={k}
						type="button"
						className={cn(tab === k && "on")}
						aria-pressed={tab === k}
						onClick={() => setTab(k)}
					>
						{label}
					</button>
				))}
			</div>
			{tab === "info" ? (
				<Info slug={slug} channel={channel} />
			) : (
				<Pins slug={slug} channelId={channel.id} />
			)}
		</aside>
	);
}

function Info({ slug, channel }: { slug: string; channel: ChatChannel }) {
	const openItem = useOpenItem(slug);
	const [allUsers, setAllUsers] = useState(false);
	const users = allUsers
		? channel.people
		: channel.people.slice(0, SHOWN_USERS);
	const link = channel.link;
	const created = new Date(channel.createdAt).toLocaleDateString([], {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
	const row = (icon: string, label: string, value: React.ReactNode) => (
		<div>
			<dt>
				<span className={cn(icon, "size-4")} aria-hidden="true" />
				{label}
			</dt>
			<dd>{value}</dd>
		</div>
	);
	return (
		<>
			<h3 className="chat-side-t">Main info</h3>
			<dl className="chat-info">
				{row(
					"icon-[solar--user-linear]",
					"Creator",
					channel.creator ? (
						<>
							<Av name={channel.creator.name} image={channel.creator.image} />
							<span className="trunc">{channel.creator.name}</span>
						</>
					) : (
						"Zadaci"
					),
				)}
				{row("icon-[solar--calendar-linear]", "Created", created)}
				{row(
					channel.private
						? "icon-[solar--lock-keyhole-minimalistic-linear]"
						: "icon-[solar--hashtag-linear]",
					"Access",
					channel.teamId
						? "The team"
						: channel.kind === "dm"
							? channel.people.length === 1
								? "Only you"
								: channel.people.length === 2
									? "You two"
									: "The people in it"
							: channel.private
								? "Members only"
								: "Everyone",
				)}
				{link &&
					row(
						link.kind === "task"
							? "icon-[solar--checklist-minimalistic-linear]"
							: "icon-[solar--folder-linear]",
						link.kind === "task" ? "Task" : "Project",
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
						</button>,
					)}
			</dl>
			{channel.topic && (
				<>
					<h3 className="chat-side-t">Topic</h3>
					<p className="chat-side-topic">{channel.topic}</p>
				</>
			)}
			<h3 className="chat-side-t">
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
			{channel.people.length > SHOWN_USERS && (
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
		</>
	);
}

function Pins({ slug, channelId }: { slug: string; channelId: string }) {
	const { data } = useQuery(CHAT_PINS, { variables: { slug, channelId } });
	const pins = data?.chatPins ?? [];
	if (data && !pins.length)
		return (
			<p className="faint chat-side-empty">
				Nothing pinned yet. Pin a message from its menu to keep it here.
			</p>
		);
	return (
		<div className="chat-pins">
			{pins.map((m) => (
				<div key={m.id} className="chat-pinned">
					<div className="chat-meta">
						<Av
							name={m.author?.name ?? "Deleted user"}
							image={m.author?.image}
						/>
						<b className="trunc">{m.author?.name ?? "Deleted user"}</b>
						<span className="faint">{ago(m.createdAt)}</span>
					</div>
					<p className="chat-text">{m.body}</p>
				</div>
			))}
		</div>
	);
}
