import { useMutation } from "@apollo/client/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Av } from "#/components/q/av";
import { ConfirmModal } from "#/components/q/confirm";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuSeparator,
	MenuTrigger,
} from "#/components/q/menu";
import {
	type ChatChannel,
	DELETE_CHAT_CHANNEL,
	FAVORITE_CHAT_CHANNEL,
	MARK_CHAT_READ,
	PIN_CHAT_CHANNEL,
} from "#/graphql/chat-operations";
import { copy, toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// The chat page's own sidebar: Favourites, Channels, Teams (each team's channel) and Direct
// messages (everyone in the workspace, you included). Each section folds away, remembered in this
// browser. Unread counts stay current through LiveUpdates. On a phone it's a drawer.

type Person = { id: string; name: string; image: string | null; isMe: boolean };
type Section = "pinned" | "favorites" | "channels" | "teams" | "dms";
/** which copy of a conversation was clicked: under Pinned, Favourites, or its own section */
export type Via = "pin" | "fav";
const FOLDED_KEY = "zadaci:chat-folded";

/** A DM is named after the others in it (just you: "Your Name (You)"); a channel after itself. */
export const titleOf = (c: ChatChannel, meId: string | undefined) =>
	c.kind === "dm"
		? c.people
				.filter((p) => p.id !== meId)
				.map((p) => p.name)
				.join(", ") || `${c.people[0]?.name ?? "You"} (You)`
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
	via,
	drawer,
	onOpenDm,

	onClose,
}: {
	slug: string;
	channels: ChatChannel[] | undefined;
	people: Person[];
	openId: string | undefined;
	/** which copy of the open conversation was clicked */
	via?: Via;
	/** a phone: shown as a drawer */
	drawer: boolean;
	/** talk to someone you have no DM with yet ([]: yourself); favorite or pin: just do that */
	onOpenDm: (
		memberIds: string[],
		opts?: { favorite?: boolean; pin?: boolean },
	) => void;

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
	// newest pin on top
	const pinnedList = all
		.filter((c) => c.pinnedAt)
		.sort((a, b) => (b.pinnedAt ?? "").localeCompare(a.pinnedAt ?? ""));
	// until the conversations load, the sections show with placeholder rows (only those load)
	const sk = (widths: number[]) =>
		widths.map((w) => (
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
		));
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
				{label}
			</button>
			{add}
			{/* the same toggle, at the far right for the mouse; the heading is the keyboard's */}
			<button
				type="button"
				className="ibtn ibtn-xs"
				tabIndex={-1}
				aria-hidden="true"
				onClick={() => fold(s)}
			>
				<span
					className={cn(
						"icon-[solar--alt-arrow-down-linear] size-3.5 chat-chev",
						folded[s] && "shut",
					)}
				/>
			</button>
		</div>
	);
	// a conversation can show up to three times (Pinned, Favourites, its own section): it opens
	// with ?via=pin|fav so only the row you clicked lights up
	const row = (c: ChatChannel, from?: Via) => {
		const on = c.id === openId && from === via;
		const other = c.people.find((p) => p.id !== me?.id) ?? c.people[0];
		return (
			<div
				key={c.id}
				className={cn(
					"sitem chat-row",
					on && "on",
					c.unread > 0 && "chat-unread",
				)}
			>
				<Link
					to="/w/$slug/chat"
					params={{ slug }}
					search={{ c: c.id, via: from }}
					className="chat-row-link"
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
				<span className="hov">
					<ChatRowMenu
						slug={slug}
						channel={c}
						title={titleOf(c, me?.id)}
						openId={openId}
					/>
				</span>
			</div>
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
				<div className="chat-sec">
					{header("pinned", "Pinned")}
					{!folded.pinned &&
						(!channels ? (
							sk([58])
						) : pinnedList.length ? (
							pinnedList.map((c) => row(c, "pin"))
						) : (
							<p className="chat-hint">
								Pin a conversation to keep it at the top.
							</p>
						))}
				</div>
				<div className="chat-sec">
					{header("favorites", "Favourites")}
					{!folded.favorites &&
						(!channels ? (
							sk([46])
						) : favorites.length ? (
							favorites.map((c) => row(c, "fav"))
						) : (
							<p className="chat-hint">Star a conversation to keep it here.</p>
						))}
				</div>
				<div className="chat-sec">
					{header("channels", "Channels", addChannel)}
					{!folded.channels && (
						<>
							{!channels && sk([52, 64])}
							{[...general, ...open].map((c) => row(c))}
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
						{!folded.teams && teams.map((c) => row(c))}
					</div>
				)}
				<div className="chat-sec">
					{header("dms", "Direct messages")}
					{!folded.dms && (
						<>
							{!channels && sk([60, 48, 70])}
							{channels &&
								everyone.map((p) => {
									const dm =
										me && dmWith(all, p.isMe ? [me.id] : [me.id, p.id]);

									if (dm) return row(dm);
									const ids = p.isMe ? [] : [p.id];
									const label = p.isMe ? `${p.name} (You)` : p.name;
									return (
										<div key={p.id} className="sitem chat-row">
											<button
												type="button"
												className="chat-row-link"
												onClick={() => {
													onOpenDm(ids);
													onClose();
												}}
											>
												<Av
													name={p.name}
													image={p.image}
													className="chat-side-av"
												/>
												<span className="trunc grow">{label}</span>
											</button>
											<span className="hov">
												<Menu>
													<MenuTrigger
														className="ibtn ibtn-xs"
														aria-label={`Options for ${label}`}
													>
														<span
															className="icon-[solar--menu-dots-bold] size-3.5"
															aria-hidden="true"
														/>
													</MenuTrigger>
													<MenuContent width={210}>
														<MenuItem
															icon="icon-[solar--chat-round-dots-linear]"
															onSelect={() => {
																onOpenDm(ids);
																onClose();
															}}
														>
															Message
														</MenuItem>
														<MenuItem
															icon="icon-[solar--pin-linear]"
															onSelect={() => onOpenDm(ids, { pin: true })}
														>
															Pin to top
														</MenuItem>
														<MenuItem
															icon="icon-[solar--star-linear]"
															onSelect={() => onOpenDm(ids, { favorite: true })}
														>
															Add to Favourites
														</MenuItem>
													</MenuContent>
												</Menu>
											</span>
										</div>
									);
								})}
							{groupDms.map((c) => row(c))}
						</>
					)}
				</div>
			</nav>
		</>
	);
}

/** A conversation's ⋯ menu in the chat sidebar. */
function ChatRowMenu({
	slug,
	channel,
	title,
	openId,
}: {
	slug: string;
	channel: ChatChannel;
	title: string;
	openId: string | undefined;
}) {
	const navigate = useNavigate();
	const [deleting, setDeleting] = useState(false);
	const refetchQueries = ["ChatChannels"];
	const [favorite] = useMutation(FAVORITE_CHAT_CHANNEL, { refetchQueries });
	const [pinTop] = useMutation(PIN_CHAT_CHANNEL, { refetchQueries });
	const [markRead] = useMutation(MARK_CHAT_READ, { refetchQueries });
	const [remove] = useMutation(DELETE_CHAT_CHANNEL, { refetchQueries });
	const name = channel.kind === "dm" ? title : `#${title}`;
	return (
		<>
			<Menu>
				<MenuTrigger
					className="ibtn ibtn-xs"
					aria-label={`Options for ${name}`}
				>
					<span
						className="icon-[solar--menu-dots-bold] size-3.5"
						aria-hidden="true"
					/>
				</MenuTrigger>
				<MenuContent width={210}>
					<MenuItem
						icon={
							channel.pinnedAt
								? "icon-[solar--pin-bold]"
								: "icon-[solar--pin-linear]"
						}
						onSelect={() =>
							void pinTop({
								variables: {
									slug,
									channelId: channel.id,
									pinned: !channel.pinnedAt,
								},
							}).catch(() => toast.error("Couldn't pin it"))
						}
					>
						{channel.pinnedAt ? "Unpin" : "Pin to top"}
					</MenuItem>
					<MenuItem
						icon={
							channel.favorite
								? "icon-[solar--star-bold]"
								: "icon-[solar--star-linear]"
						}
						onSelect={() =>
							void favorite({
								variables: {
									slug,
									channelId: channel.id,
									favorite: !channel.favorite,
								},
							}).catch(() => toast.error("Couldn't update Favourites"))
						}
					>
						{channel.favorite ? "Remove from Favourites" : "Add to Favourites"}
					</MenuItem>
					{channel.unread > 0 && (
						<MenuItem
							icon="icon-[solar--check-read-linear]"
							onSelect={() =>
								void markRead({
									variables: { slug, channelId: channel.id },
								}).catch(() => toast.error("Couldn't mark it read"))
							}
						>
							Mark as read
						</MenuItem>
					)}
					<MenuItem
						icon="icon-[solar--link-linear]"
						onSelect={() =>
							copy(`${window.location.origin}/w/${slug}/chat?c=${channel.id}`)
						}
					>
						Copy link
					</MenuItem>
					{channel.canDelete && (
						<>
							<MenuSeparator />
							<MenuItem
								icon="icon-[solar--trash-bin-trash-linear]"
								danger
								onSelect={() => setDeleting(true)}
							>
								Delete channel
							</MenuItem>
						</>
					)}
				</MenuContent>
			</Menu>
			<ConfirmModal
				open={deleting}
				onOpenChange={setDeleting}
				title={`Delete ${name}?`}
				body="It leaves everyone's list, and its messages and files can't be read any more."
				ok="Delete channel"
				danger
				icon="icon-[solar--trash-bin-trash-linear]"
				onConfirm={async () => {
					await toast.promise(
						remove({ variables: { slug, channelId: channel.id } }),
						{
							loading: "Deleting…",
							success: "Channel deleted",
							error: (e) => (e as Error).message || "Couldn't delete it",
						},
					);
					// it was open: go back to #general
					if (openId === channel.id)
						void navigate({ to: "/w/$slug/chat", params: { slug } });
				}}
			/>
		</>
	);
}
