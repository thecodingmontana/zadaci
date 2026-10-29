import { useMutation, useQuery } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useOpenItem } from "#/components/ai/assistant-parts";
import { Av } from "#/components/q/av";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "#/components/q/menu";
import { Modal } from "#/components/q/modal";
import {
	CHAT_MEMBERS,
	CHAT_PINS,
	type ChatChannel,
	OPEN_CHAT_DM,
} from "#/graphql/chat-operations";
import { useOnline } from "#/lib/online";
import { ago } from "#/lib/time";
import { copy, toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import type { Mentionable } from "./chat-message";
import { Face } from "./chat-nav";

// A channel's details beside the conversation: who made it and what it's about (Info), and its
// pinned messages (Pins).

export function ChannelDetails({
	slug,
	channel,
	tab: first = "info",
	members,
	meId,
	closing,
	onClose,
}: {
	slug: string;
	channel: ChatChannel;
	/** the people in it: everyone in the workspace for an open channel */
	members: Mentionable[];
	meId: string | undefined;
	/** on its way out: plays the closing animation */
	closing?: boolean;
	/** the tab it opens on */
	tab?: "info" | "pins";
	onClose: () => void;
}) {
	const [tab, setTab] = useState(first);
	return (
		<aside
			className={cn("chat-side", closing && "closing")}
			aria-label="Details"
		>
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
				<Info slug={slug} channel={channel} members={members} meId={meId} />
			) : (
				<Pins slug={slug} channelId={channel.id} />
			)}
		</aside>
	);
}

function Info({
	slug,
	channel,
	members,
	meId,
}: {
	slug: string;
	channel: ChatChannel;
	members: Mentionable[];
	meId: string | undefined;
}) {
	const openItem = useOpenItem(slug);
	// whose profile is open
	const [profile, setProfile] = useState<string | null>(null);
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
				Users <span className="chat-count">{members.length}</span>
			</h3>
			<div className="chat-people">
				{members.map((p) => (
					<PersonRow
						key={p.id}
						slug={slug}
						person={p}
						isMe={p.id === meId}
						onOpen={() => setProfile(p.id)}
					/>
				))}
			</div>
			{profile && (
				<PersonModal
					slug={slug}
					memberId={profile}
					onClose={() => setProfile(null)}
				/>
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

/** Someone in the conversation: avatar (with their online dot), name, and a ⋯ menu. */
function PersonRow({
	slug,
	person,
	isMe,
	onOpen,
}: {
	slug: string;
	person: Mentionable;
	isMe: boolean;
	onOpen: () => void;
}) {
	const online = useOnline();
	return (
		<div className="sitem chat-row chat-person-row">
			<button type="button" className="chat-row-link" onClick={onOpen}>
				<Face
					name={person.name}
					image={person.image}
					online={isMe || online.has(person.id)}
				/>
				<span className="trunc grow">
					{person.name}
					{isMe && <span className="faint"> (You)</span>}
				</span>
			</button>
			<span className="hov">
				<PersonMenu slug={slug} person={person} isMe={isMe} onOpen={onOpen} />
			</span>
		</div>
	);
}

/** A person's ⋯ menu: message them, see their profile, copy their email. */
function PersonMenu({
	slug,
	person,
	isMe,
	onOpen,
}: {
	slug: string;
	person: Mentionable;
	isMe: boolean;
	onOpen: () => void;
}) {
	const message = useMessage(slug);
	const email = useQuery(CHAT_MEMBERS, {
		variables: { slug },
	}).data?.workspace?.members.find((m) => m.id === person.id)?.email;
	return (
		<Menu>
			<MenuTrigger
				className="ibtn ibtn-xs"
				aria-label={`Options for ${person.name}`}
			>
				<span
					className="icon-[solar--menu-dots-bold] size-3.5"
					aria-hidden="true"
				/>
			</MenuTrigger>
			<MenuContent width={200}>
				<MenuItem
					icon="icon-[solar--chat-round-dots-linear]"
					onSelect={() => void message(isMe ? [] : [person.id])}
				>
					{isMe ? "Note to self" : "Message"}
				</MenuItem>
				<MenuItem icon="icon-[solar--user-linear]" onSelect={onOpen}>
					View profile
				</MenuItem>
				{email && (
					<MenuItem
						icon="icon-[solar--letter-linear]"
						onSelect={() => copy(email)}
					>
						Copy email
					</MenuItem>
				)}
			</MenuContent>
		</Menu>
	);
}

/** Opens your DM with these people ([]: yourself), starting it if need be. */
function useMessage(slug: string) {
	const navigate = useNavigate();
	const [open] = useMutation(OPEN_CHAT_DM, {
		refetchQueries: ["ChatChannels"],
	});
	return async (memberIds: string[]) => {
		try {
			const { data } = await open({ variables: { slug, memberIds } });
			if (data)
				void navigate({
					to: "/w/$slug/chat",
					params: { slug },
					search: { c: data.openChatDm.id },
				});
		} catch (e) {
			toast.error("Couldn't open the conversation", {
				desc: (e as Error).message,
			});
		}
	};
}

/** Someone's profile, like a task opens: who they are, how to reach them, and what you can do. */
function PersonModal({
	slug,
	memberId,
	onClose,
}: {
	slug: string;
	memberId: string;
	onClose: () => void;
}) {
	const navigate = useNavigate();
	const message = useMessage(slug);
	const online = useOnline();
	const { data } = useQuery(CHAT_MEMBERS, { variables: { slug } });
	const p = data?.workspace?.members.find((m) => m.id === memberId);
	const isOn = !!p && (p.isMe || online.has(p.id));
	const localTime = (tz: string | null) => {
		if (!tz) return null;
		try {
			return new Date().toLocaleTimeString([], {
				hour: "numeric",
				minute: "2-digit",
				timeZone: tz,
			});
		} catch {
			return null;
		}
	};
	const time = p ? localTime(p.tz) : null;
	return (
		<Modal
			open
			onOpenChange={(o) => !o && onClose()}
			title={p?.name ?? "Profile"}
			size="sm"
			footer={
				p && (
					<>
						<button
							type="button"
							className="btn btn-secondary btn-sm"
							onClick={() => {
								onClose();
								void navigate({
									to: "/w/$slug/members/$memberId",
									params: { slug, memberId: p.id },
								});
							}}
						>
							View profile
						</button>
						<span className="sp" />
						<button
							type="button"
							className="btn btn-primary btn-sm"
							onClick={() => {
								onClose();
								void message(p.isMe ? [] : [p.id]);
							}}
						>
							<span
								className="icon-[solar--chat-round-dots-linear] size-4"
								aria-hidden="true"
							/>
							{p.isMe ? "Note to self" : "Message"}
						</button>
					</>
				)
			}
		>
			<div className="modal-b chat-profile">
				{!p ? (
					<p className="faint">Loading…</p>
				) : (
					<>
						<div className="chat-profile-head">
							<Face
								name={p.name}
								image={p.image}
								online={isOn}
								className="chat-profile-av"
							/>
							<div className="chat-profile-who">
								<b>
									{p.name}
									{p.isMe && <span className="faint"> (You)</span>}
								</b>
								{p.title && <span className="faint">{p.title}</span>}
								<span className={cn("chat-profile-state", isOn && "on")}>
									{isOn ? "Online" : "Offline"}
								</span>
							</div>
						</div>
						<dl className="chat-info">
							<div>
								<dt>
									<span
										className="icon-[solar--letter-linear] size-4"
										aria-hidden="true"
									/>
									Email
								</dt>
								<dd>
									<a className="chat-link" href={`mailto:${p.email}`}>
										<span className="trunc">{p.email}</span>
									</a>
								</dd>
							</div>
							<div>
								<dt>
									<span
										className="icon-[solar--shield-user-linear] size-4"
										aria-hidden="true"
									/>
									Role
								</dt>
								<dd className="chat-profile-role">{p.role}</dd>
							</div>
							{time && (
								<div>
									<dt>
										<span
											className="icon-[solar--clock-circle-linear] size-4"
											aria-hidden="true"
										/>
										Local time
									</dt>
									<dd>{time}</dd>
								</div>
							)}
						</dl>
					</>
				)}
			</div>
		</Modal>
	);
}
