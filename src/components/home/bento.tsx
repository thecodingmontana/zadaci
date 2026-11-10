import { lazy, type ReactNode } from "react";
import { Av } from "#/components/q/av";
import { LazyMount } from "./lazy";
import { Reveal, RiseLines } from "./reveal";

// "And everything else": the rest of what Zadaci does, one tile each, most with a small live piece
// of the real app (src/components/home/bento-tiles.tsx, loaded as it nears the screen).

const tiles = () => import("./bento-tiles");
const CommandLazy = lazy(() =>
	tiles().then((m) => ({ default: m.CommandTile })),
);
const TimerLazy = lazy(() => tiles().then((m) => ({ default: m.TimerTile })));
const RoleLazy = lazy(() =>
	import("./bento-team-tiles").then((m) => ({ default: m.RoleTile })),
);
const ShareLazy = lazy(() =>
	import("./bento-team-tiles").then((m) => ({ default: m.ShareTile })),
);
const StatusLazy = lazy(() => tiles().then((m) => ({ default: m.StatusTile })));
const Command = () => (
	<LazyMount Demo={CommandLazy} height={232} frame={false} />
);
const Timer = () => <LazyMount Demo={TimerLazy} height={120} frame={false} />;
const Role = () => <LazyMount Demo={RoleLazy} height={232} frame={false} />;
const Share = () => <LazyMount Demo={ShareLazy} height={150} frame={false} />;
const Status = () => <LazyMount Demo={StatusLazy} height={120} frame={false} />;

function Tile({
	title,
	body,
	children,
	wide = false,
	i,
}: {
	title: string;
	body: string;
	children?: ReactNode;
	wide?: boolean;
	i: number;
}) {
	return (
		<Reveal
			as="li"
			delay={(i % 3) * 0.08}
			className={`flex flex-col overflow-hidden rounded-(--q-r-lg) border border-(color:--q-border) bg-(--q-surface) ${wide ? "md:col-span-2" : ""}`}
		>
			<div className="mt-auto order-2 px-5 pt-1 pb-5">
				<h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
				<p className="mt-1 text-(length:--q-fs) leading-relaxed text-(color:--q-text-3)">
					{body}
				</p>
			</div>
			<div className="order-1 border-b border-(color:--q-divider) bg-(--q-bg)">
				{children}
			</div>
		</Reveal>
	);
}

const ACTIVITY = [
	["Leo Park", "commented on", "Offline mode for task lists", "2m"],
	["Maya Chen", "invited", "jonas@northwind.dev", "14m"],
	["Amara Osei", "joined the workspace", "", "1h"],
] as const;

const FILES = [
	["icon-[solar--gallery-wide-linear]", "onboarding-v3.png", "1.2 MB"],
	["icon-[solar--document-text-linear]", "beta-feedback.pdf", "340 KB"],
	["icon-[solar--videocamera-record-linear]", "sync-demo.mp4", "8.4 MB"],
] as const;

export function Bento() {
	return (
		<section
			aria-labelledby="more-title"
			className="scroll-mt-14 border-t border-(color:--q-border)"
		>
			<div className="mx-auto max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20 lg:pt-28">
				<RiseLines
					id="more-title"
					lines={["And everything", "else a team needs"]}
					className="text-[2.2rem] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-5xl"
				/>
				<ul className="mt-10 grid gap-3 sm:mt-14 md:grid-cols-3">
					<Tile
						i={0}
						wide
						title="Everything a keystroke away"
						body="Press Ctrl or ⌘ K to reach any page, setting or action. Type a few letters and go."
					>
						<Command />
					</Tile>
					<Tile
						i={1}
						title="Know where the hours go"
						body="Start a timer on any task. One runs at a time, so the totals stay honest."
					>
						<Timer />
					</Tile>
					<Tile
						i={2}
						title="Everyone sees just enough"
						body="Owner, Admin, Member or Guest, plus teams, invite links and private or shared projects."
					>
						<Role />
					</Tile>
					<Tile
						i={3}
						wide
						title="Share without an account"
						body="Send a read-only link to a project or a note. Anyone can open it; nobody can change it."
					>
						<Share />
					</Tile>
					<Tile
						i={4}
						title="See what changed"
						body="A workspace activity feed, and every task keeps its own history."
					>
						<div className="py-2">
							{ACTIVITY.map(([who, verb, what, ago]) => (
								<div
									key={who}
									className="act-line"
									style={{ padding: "6px 16px" }}
								>
									<span className="ico">
										<Av name={who} className="sm" />
									</span>
									<span className="grow trunc">
										<b>{who}</b> {verb} {what}
									</span>
									<time className="faint" style={{ fontSize: 11.5 }}>
										{ago}
									</time>
								</div>
							))}
						</div>
					</Tile>
					<Tile
						i={5}
						title="Files where the work is"
						body="Attach pictures, videos and documents to tasks, and find a project's files in one view."
					>
						<div className="py-2">
							{FILES.map(([icon, name, size]) => (
								<div
									key={name}
									className="row"
									style={{ gap: 10, padding: "7px 16px" }}
								>
									<span className={`${icon} size-4 faint shrink-0`} />
									<span className="grow trunc">{name}</span>
									<span className="faint" style={{ fontSize: 11.5 }}>
										{size}
									</span>
								</div>
							))}
						</div>
					</Tile>
					<Tile
						i={6}
						title="Works like an app"
						body="Install it on your desktop or phone. It says when you're offline, and when a new version is ready."
					>
						<Status />
					</Tile>
					<Tile
						i={7}
						title="Sign in your way"
						body="Passkeys, a one-time email link or Google, with optional two-step verification on top."
					>
						<div
							className="row"
							style={{ gap: 8, padding: "16px", flexWrap: "wrap" }}
						>
							<span className="pillbtn bordered">
								<span className="icon-[solar--key-minimalistic-linear] size-3.5" />
								Passkey
							</span>
							<span className="pillbtn bordered">
								<span className="icon-[solar--letter-linear] size-3.5" />
								Email link
							</span>
							<span className="pillbtn bordered">
								<span className="icon-[simple-icons--google] size-3" />
								Google
							</span>
							<span className="badge green">
								<span className="dot" />
								Two-step on
							</span>
						</div>
					</Tile>
					<Tile
						i={8}
						title="Your data stays yours"
						body="Download everything that's yours as one file, import a workspace, or delete your account whenever you like."
					>
						<div className="row" style={{ gap: 8, padding: "16px" }}>
							<span className="btn btn-secondary btn-sm">
								<span className="icon-[solar--download-minimalistic-linear] size-3.5" />
								Download my data
							</span>
						</div>
					</Tile>
				</ul>
			</div>
		</section>
	);
}
