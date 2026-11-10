import { AnimatePresence, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { Av } from "#/components/q/av";
import { ToastCard } from "#/components/toast/toast-card";
import type { ToastData } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { Stage, useDemoLoop } from "./demo-stage";

// The Notifications page, drawn with its own classes (.ph, .badge, .seg, .panel, .nrow): new ones
// land at the top unread, with the orange dot, and the unread count goes up. Rows simply appear,
// as they do in the app when live updates bring them in.

type Note = {
	id: string;
	who?: string;
	text: string;
	task: string;
	snippet?: string;
	meta: string;
	icon?: string;
};

const START: Note[] = [
	{
		id: "a",
		who: "Leo Park",
		text: "commented on",
		task: "Offline mode for task lists",
		snippet: "Writes queue up and replay when the connection comes back.",
		meta: "Mobile app 2.0 · 1h ago",
	},
	{
		id: "b",
		text: "is due tomorrow",
		task: "Push notification settings",
		meta: "Mobile app 2.0 · 3h ago",
		icon: "icon-[solar--clock-circle-linear]",
	},
	{
		id: "c",
		who: "Jonas Weber",
		text: "assigned you",
		task: "Beta feedback round two",
		meta: "Mobile app 2.0 · yesterday",
	},
];
const NEW: Note[] = [
	{
		id: "d",
		who: "Amara Osei",
		text: "mentioned you in",
		task: "Dark mode polish on iPad",
		snippet: "@Maya Chen the contrast on the sidebar looks right now.",
		meta: "Mobile app 2.0 · just now",
	},
	{
		id: "e",
		who: "Leo Park",
		text: "assigned you",
		task: "Sync conflicts when two people edit",
		meta: "Mobile app 2.0 · just now",
	},
];

const CAUGHT_UP: ToastData = {
	id: 2,
	type: "success",
	title: "You're all caught up.",
	duration: 2400,
};

function Row({ n, unread }: { n: Note; unread: boolean }) {
	return (
		<div className={cn("nrow", unread && "unread")}>
			{n.who ? (
				<Av name={n.who} className="md" />
			) : (
				<span
					className="av md"
					style={{ "--c": "var(--q-amber)" } as React.CSSProperties}
				>
					<span className={cn(n.icon, "size-[13px]")} />
				</span>
			)}
			<div className="grow" style={{ fontSize: 13 }}>
				<div>
					{n.who && <b className="font-semibold">{n.who} </b>}
					{n.who ? (
						<span className="muted">{n.text}</span>
					) : (
						<b className="font-semibold">{n.task}</b>
					)}{" "}
					{n.who ? (
						<b className="font-medium">{n.task}</b>
					) : (
						<span className="muted">{n.text}</span>
					)}
				</div>
				{n.snippet && (
					<div className="muted trunc" style={{ fontSize: 12.5, marginTop: 2 }}>
						{n.snippet}
					</div>
				)}
				<div className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>
					{n.meta}
				</div>
			</div>
			{unread && (
				<span
					style={{
						width: 7,
						height: 7,
						borderRadius: "50%",
						background: "var(--q-accent)",
						marginTop: 8,
						flexShrink: 0,
					}}
				/>
			)}
			<span className="ibtn ibtn-sm">
				<span
					className={cn(
						unread
							? "icon-[hugeicons--tick-02]"
							: "icon-[solar--letter-linear]",
						"size-3.5",
					)}
				/>
			</span>
		</div>
	);
}

export function InboxDemo() {
	const stage = useRef<HTMLDivElement>(null);
	const [arrived, setArrived] = useState(0);
	const [read, setRead] = useState<string[]>([]);
	const [toast, setToast] = useState(false);
	const reduce = useReducedMotion() ?? false;

	useDemoLoop(
		stage,
		async (wait) => {
			await wait(1400);
			setArrived(1);
			await wait(2200);
			setArrived(2);
			await wait(2400);
			setRead(["a", "d", "e"]); // Mark all as read
			setToast(true);
			await wait(2600);
		},
		() => {
			setArrived(0);
			setRead([]);
			setToast(false);
		},
		() => setArrived(2),
	);

	const fresh = NEW.slice(0, arrived).reverse();
	const unreadIds = ["a", ...fresh.map((n) => n.id)].filter(
		(id) => !read.includes(id),
	);
	const unread = unreadIds.length;
	return (
		<Stage
			width={640}
			height={470}
			label="Zadaci notifications: new mentions and assignments arrive unread"
			stageRef={stage}
			fluid
		>
			<div
				className="page"
				style={{ padding: "22px 20px 0", maxWidth: "none" }}
			>
				<div className="ph">
					<div>
						<h1 className="row" style={{ gap: 10 }}>
							Notifications
							{unread > 0 && (
								<span className="badge accent">{unread} unread</span>
							)}
						</h1>
						<p>Updates on tasks and projects you follow.</p>
					</div>
					<div className="acts">
						<div className="seg">
							<button type="button" className="on">
								All
							</button>
							<button type="button">Unread</button>
						</div>
						<span className="btn btn-secondary" aria-disabled={!unread}>
							<span className="icon-[solar--check-read-linear] size-3.5" />
							Mark all as read
						</span>
					</div>
				</div>
				<div className="day-h">Today</div>
				<div className="panel" style={{ overflow: "hidden" }}>
					{[...fresh, ...START].map((n) => (
						<Row key={n.id} n={n} unread={unreadIds.includes(n.id)} />
					))}
				</div>
			</div>
			<div
				className="tst-root absolute right-4 bottom-4"
				style={{ width: 300, height: 64, zIndex: 2 }}
			>
				<AnimatePresence>
					{toast && (
						<ToastCard
							t={CAUGHT_UP}
							layout={{ ty: 0, s: 1, o: 1, contentShown: true, z: 1 }}
							paused={false}
							reduce={reduce}
							isBottom
							onHeight={() => {}}
							onClose={() => setToast(false)}
						/>
					)}
				</AnimatePresence>
			</div>
		</Stage>
	);
}
