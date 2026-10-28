import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Av } from "#/components/q/av";
import type { ChatChannel } from "#/graphql/chat-operations";
import { cn } from "#/lib/utils";

// The chat page's own sidebar: Favourites, Channels, Teams (each team's channel) and Direct
// messages (everyone in the workspace, you included). Each section folds away, remembered in this
// browser. Unread counts stay current through LiveUpdates. On a phone it's a drawer.

type Person = { id: string; name: string; image: string | null; isMe: boolean };
type Section = "favorites" | "channels" | "teams" | "dms";
const FOLDED_KEY = "zadaci:chat-folded";

/** A DM is named after the others in it (just you: your own notes); a channel after itself. */
export const titleOf = (c: ChatChannel, meId: string | undefined) =>
	c.kind === "dm"
		? c.people
				.filter((p) => p.id !== meId)
				.map((p) => p.name)
				.join(", ") || "Notes to self"
		: (c.name ?? "");

/** The DM with exactly these people (you included), if it exists. */
export const dmWith = (channels: ChatChannel[], ids: string[]) => {
	const want = [...new Set(ids)].sort().join(",");
	return channels.find(
		(c) =>
			c.kind === "dm" &&
			c.people
				.map((p) => p.id)
				.sort()
				.join(",") === want,
	);
};

export function ChatNav({
	slug,
	channels,
	people,
	openId,
	drawer,
	onOpenDm,
	onPins,
	onClose,
}: {
	slug: string;
	channels: ChatChannel[] | undefined;
	people: Person[];
	openId: string | undefined;
	/** a phone: shown as a drawer */
	drawer: boolean;
	/** talk to someone you have no DM with yet ([]: yourself) */
	onOpenDm: (memberIds: string[]) => void;
	/** show the open conversation's pinned messages */
	onPins: () => void;
	onClose: () => void;
}) {
	const [folded, setFolded] = useState<Partial<Record<Section, boolean>>>({});
	useEffect(() => {
		try {
			setFolded(JSON.parse(localStorage.getItem(FOLDED_KEY) ?? "{}"));
		} catch {
			// private mode: everything starts open
		}
	}, []);
	const fold = (s: Section) =>
		setFolded((f) => {
			const next = { ...f, [s]: !f[s] };
			try {
				localStorage.setItem(FOLDED_KEY, JSON.stringify(next));
			} catch {
				// not remembered; still folds for now
			}
			return next;
		});

	const me = people.find((p) => p.isMe);
	const all = channels ?? [];
	const favorites = all.filter((c) => c.favorite);
	// Favourites is a shortcut: a starred conversation is still in its own section too
	const rest = all;
	const general = rest.filter((c) => c.general);
	const open = rest.filter(
		(c) => c.kind === "channel" && !c.teamId && !c.general,
	);
	const teams = rest.filter((c) => c.teamId);
	const groupDms = rest.filter((c) => c.kind === "dm" && c.people.length > 2);
	// you first, then everyone else by name
	const everyone = [...people].sort(
		(a, b) => Number(b.isMe) - Number(a.isMe) || a.name.localeCompare(b.name),
	);

	const header = (s: Section, label: string, add?: React.ReactNode) => (
		<div className="chat-gh">
			<button
				type="button"
				className="chat-fold"
				aria-expanded={!folded[s]}
				onClick={() => fold(s)}
			>
				<span>{label}</span>
				<span
					className={cn(
						"icon-[solar--alt-arrow-down-linear] size-3.5 chat-chev",
						folded[s] && "shut",
					)}
					aria-hidden="true"
				/>
			</button>
			{add}
		</div>
	);
	const row = (c: ChatChannel) => {
		const on = c.id === openId;
		const other = c.people.find((p) => p.id !== me?.id) ?? c.people[0];
		return (
			<Link
				key={c.id}
				to="/w/$slug/chat"
				params={{ slug }}
				search={{ c: c.id }}
				className={cn("sitem", on && "on", c.unread > 0 && "chat-unread")}
				aria-current={on ? "page" : undefined}
				onClick={onClose}
			>
				{c.kind === "dm" ? (
					<Av
						name={other?.name ?? "?"}
						image={other?.image}
						className="chat-side-av"
					/>
				) : (
					<span
						className={cn(
							"size-[15px] shrink-0",
							c.teamId
								? "icon-[solar--users-group-two-rounded-linear]"
								: c.private
									? "icon-[solar--lock-keyhole-minimalistic-linear]"
									: "icon-[solar--hashtag-linear]",
						)}
						aria-hidden="true"
					/>
				)}
				<span className="trunc grow">{titleOf(c, me?.id)}</span>
				{c.unread > 0 && <span className="ct dotc">{c.unread}</span>}
			</Link>
		);
	};
	const addChannel = (
		<Link
			to="/w/$slug/chat"
			params={{ slug }}
			search={(prev) => ({ ...prev, new: "channel" as const })}
			className="ibtn ibtn-xs"
			aria-label="Add channel"
			data-tip="Add channel"
			onClick={onClose}
		>
			<span
				className="icon-[hugeicons--plus-sign] size-3.5"
				aria-hidden="true"
			/>
		</Link>
	);

	return (
		<>
			{drawer && (
				<button
					type="button"
					className="chat-scrim"
					aria-label="Close conversations"
					onClick={onClose}
				/>
			)}
			<nav
				className={cn("chat-nav", drawer && "open")}
				aria-label="Conversations"
			>
				{/* until they load, placeholders only (no empty sections) */}
				{!channels &&
					[64, 48, 72, 56].map((w) => (
						<div
							key={w}
							className="sitem"
							style={{ cursor: "default" }}
							aria-hidden="true"
						>
							<span
								className="sk"
								style={{ width: 14, height: 14, borderRadius: 4 }}
							/>
							<span className="sk" style={{ width: `${w}%`, height: 11 }} />
						</div>
					))}
				{channels && (
					<>
						<button
							type="button"
							className="sitem chat-pins-link"
							disabled={!openId}
							onClick={() => {
								onPins();
								onClose();
							}}
						>
							<span
								className="icon-[solar--pin-linear] size-[15px] shrink-0"
								aria-hidden="true"
							/>
							<span className="trunc grow">Pinned</span>
						</button>
						<div className="chat-sec">
							{header("favorites", "Favourites")}
							{!folded.favorites &&
								(favorites.length ? (
									favorites.map(row)
								) : (
									<p className="chat-hint">
										Star a conversation to keep it here.
									</p>
								))}
						</div>
						<div className="chat-sec">
							{header("channels", "Channels", addChannel)}
							{!folded.channels && (
								<>
									{[...general, ...open].map(row)}
									<Link
										to="/w/$slug/chat"
										params={{ slug }}
										search={(prev) => ({ ...prev, new: "channel" as const })}
										className="sitem chat-add"
										onClick={onClose}
									>
										<span
											className="icon-[hugeicons--plus-sign] size-3.5 shrink-0"
											aria-hidden="true"
										/>
										<span className="trunc">Add channel</span>
									</Link>
								</>
							)}
						</div>
						{teams.length > 0 && (
							<div className="chat-sec">
								{header("teams", "Teams")}
								{!folded.teams && teams.map(row)}
							</div>
						)}
						<div className="chat-sec">
							{header("dms", "Direct messages")}
							{!folded.dms && (
								<>
									{everyone.map((p) => {
										const dm =
											me && dmWith(all, p.isMe ? [me.id] : [me.id, p.id]);

										if (dm) return row(dm);
										return (
											<button
												key={p.id}
												type="button"
												className="sitem"
												onClick={() => {
													onOpenDm(p.isMe ? [] : [p.id]);
													onClose();
												}}
											>
												<Av
													name={p.name}
													image={p.image}
													className="chat-side-av"
												/>
												<span className="trunc grow">
													{p.isMe ? "Notes to self" : p.name}
												</span>
											</button>
										);
									})}
									{groupDms.map(row)}
								</>
							)}
						</div>
					</>
				)}
			</nav>
		</>
	);
}
