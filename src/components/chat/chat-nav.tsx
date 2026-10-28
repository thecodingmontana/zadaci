import { Link } from "@tanstack/react-router";
import { Av } from "#/components/q/av";
import type { ChatChannel } from "#/graphql/chat-operations";
import { cn } from "#/lib/utils";

// The chat page's own sidebar (like Settings' nav): channels, then direct messages, with unread
// counts kept current by LiveUpdates. On a phone it becomes a row of tabs, like Settings.

/** A DM is named after the others in it; a channel after itself. */
export const titleOf = (c: ChatChannel, meName: string | undefined) =>
	c.kind === "dm"
		? c.people
				.filter((p) => p.name !== meName)
				.map((p) => p.name)
				.join(", ") || "Just you"
		: (c.name ?? "");

/** #general first, then the busiest (the API sends newest activity first). */
export const sortChannels = (channels: ChatChannel[]) =>
	[...channels].sort((a, b) => Number(b.general) - Number(a.general));

export function ChatNav({
	slug,
	channels,
	openId,
	meName,
}: {
	slug: string;
	channels: ChatChannel[] | undefined;
	openId: string | undefined;
	meName: string | undefined;
}) {
	const group = (kind: "channel" | "dm") => {
		const rows = sortChannels(channels ?? []).filter((c) => c.kind === kind);
		const add = kind === "channel" ? "Add channel" : "New message";
		return (
			<>
				<div className="gh chat-gh">
					<span className="grow">
						{kind === "channel" ? "Channels" : "Direct messages"}
					</span>
					<Link
						to="/w/$slug/chat"
						params={{ slug }}
						search={(prev) => ({ ...prev, new: kind })}
						className="ibtn ibtn-xs"
						aria-label={add}
						data-tip={add}
					>
						<span
							className="icon-[hugeicons--plus-sign] size-3.5"
							aria-hidden="true"
						/>
					</Link>
				</div>
				{!channels && (
					<div
						className="sitem"
						style={{ cursor: "default" }}
						aria-hidden="true"
					>
						<span
							className="sk"
							style={{ width: 14, height: 14, borderRadius: 4 }}
						/>
						<span className="sk" style={{ width: "60%", height: 11 }} />
					</div>
				)}
				{rows.map((c) => {
					const title = titleOf(c, meName);
					const other = c.people.find((p) => p.name !== meName);
					const on = c.id === openId;
					return (
						<Link
							key={c.id}
							to="/w/$slug/chat"
							params={{ slug }}
							search={{ c: c.id }}
							className={cn("sitem", on && "on", c.unread > 0 && "chat-unread")}
							aria-current={on ? "page" : undefined}
						>
							{kind === "dm" ? (
								<Av
									name={other?.name ?? title}
									image={other?.image}
									className="chat-side-av"
								/>
							) : (
								<span
									className={cn(
										"size-[15px] shrink-0",
										c.private
											? "icon-[solar--lock-keyhole-minimalistic-linear]"
											: "icon-[solar--hashtag-linear]",
									)}
									aria-hidden="true"
								/>
							)}
							<span className="trunc grow">{title}</span>
							{c.unread > 0 && <span className="ct dotc">{c.unread}</span>}
						</Link>
					);
				})}
				{channels && (
					<Link
						to="/w/$slug/chat"
						params={{ slug }}
						search={(prev) => ({ ...prev, new: kind })}
						className="sitem chat-add"
					>
						<span
							className="icon-[hugeicons--plus-sign] size-3.5 shrink-0"
							aria-hidden="true"
						/>
						<span className="faint trunc">{add}</span>
					</Link>
				)}
			</>
		);
	};

	return (
		<nav className="set-nav chat-nav" aria-label="Conversations">
			{group("channel")}
			{group("dm")}
		</nav>
	);
}
