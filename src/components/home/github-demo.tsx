import { AnimatePresence } from "motion/react";
import { useRef, useState } from "react";
import { Av, AvStack } from "#/components/q/av";
import { PrPill, StPill } from "#/components/tasks/bits";
import { ToastCard } from "#/components/toast/toast-card";
import type { ToastData } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { Stage, useDemoLoop } from "./demo-stage";

// A task linked to a GitHub issue, drawn with the task panel's own classes (.drawer, .kv, .dsec,
// .cmt, .badge) beside the project's GitHub window: Sync now, a pull request shows up, a comment
// written on GitHub arrives, the PR merges and the task completes.

const MAYA = "Maya Chen";
const COMMENTS = [
	{
		id: "a",
		who: MAYA,
		ago: "2h ago",
		text: "Repro: edit the same list on two phones while offline, then reconnect both.",
	},
	// how a comment written on GitHub is saved on its task (src/lib/github-comments.server.ts)
	{
		id: "b",
		who: MAYA,
		ago: "just now",
		text: "**@leopark** on GitHub:\n\nFix is up in #214. Last write wins per field now, so neither phone loses its edits.",
	},
];
const SYNC_TOAST: ToastData = {
	id: 1,
	type: "success",
	title: "Syncing with GitHub",
	desc: "Tasks and issues line up in a minute or so.",
	duration: 4000,
};
const LAYOUT = { ty: 0, s: 1, o: 1, contentShown: true, z: 1 };

const prop = (icon: string, label: string, value: React.ReactNode) => (
	<>
		<dt>
			<span className={cn(icon, "size-3.5")} />
			{label}
		</dt>
		<dd>{value}</dd>
	</>
);

export function GithubDemo() {
	const stage = useRef<HTMLDivElement>(null);
	const [syncing, setSyncing] = useState(false);
	const [toast, setToast] = useState(false);
	const [pr, setPr] = useState<null | "open" | "merged">(null);
	const [comments, setComments] = useState(1);
	const [round, setRound] = useState(0);
	const done = pr === "merged";

	const reduce = useDemoLoop(
		stage,
		async (wait) => {
			await wait(1200);
			setSyncing(true);
			await wait(700);
			setSyncing(false);
			setToast(true);
			await wait(900);
			setPr("open");
			await wait(1500);
			setComments(2);
			await wait(1800);
			setPr("merged");
			await wait(4200);
		},
		() => {
			setSyncing(false);
			setToast(false);
			setPr(null);
			setComments(1);
			setRound((r) => r + 1);
		},
		() => {
			setPr("merged");
			setComments(2);
		},
	);

	return (
		<Stage
			width={1000}
			height={620}
			label="A Zadaci task linked to a GitHub issue: a pull request and a GitHub comment arrive, and merging completes the task"
			stageRef={stage}
			fluid
		>
			{(w) => (
				<>
					{w >= 900 && (
						<div className="absolute top-6 left-6" style={{ width: 380 }}>
							<div className="modal" style={{ maxWidth: "none" }}>
								<div className="modal-h">
									<div>
										<h2>GitHub</h2>
										<div
											className="muted"
											style={{ fontSize: 12.5, marginTop: 2 }}
										>
											Pull requests that mention a task's key (like WEB-12 in
											the title, or a branch named web-12-login) show on the
											task, and merging one completes it.
										</div>
									</div>
									<span className="ibtn ibtn-sm">
										<span className="icon-[solar--close-linear] size-4" />
									</span>
								</div>
								<div
									className="modal-b"
									style={{ display: "flex", flexDirection: "column", gap: 14 }}
								>
									<div className="row" style={{ gap: 8, alignItems: "center" }}>
										<span className="icon-[simple-icons--github] size-4" />
										<span className="grow" style={{ fontWeight: 600 }}>
											northwind/mobile
										</span>
										<span
											className={cn(
												"btn btn-secondary btn-sm",
												syncing && "is-loading",
											)}
										>
											<span className="icon-[solar--refresh-linear] size-3.5" />
											Sync now
										</span>
										<span className="btn btn-danger-ghost btn-sm">Unlink</span>
									</div>
									<span
										className="row"
										style={{ gap: 6, fontSize: 12.5, alignItems: "center" }}
									>
										<span className="icon-[solar--widget-5-linear] size-3.5" />
										Its board on GitHub, kept in step with this project
									</span>
								</div>
							</div>
						</div>
					)}
					<aside
						key={round}
						className="drawer enter"
						style={{
							position: "absolute",
							top: 0,
							right: 0,
							bottom: 0,
							width: w >= 900 ? 560 : "100%",
							zIndex: 1,
							borderLeft: w >= 900 ? undefined : 0,
						}}
					>
						<div className="drawer-h">
							<span className="pillbtn" style={{ fontSize: 12.5 }}>
								<span
									className="pdot"
									style={{ "--c": "#8662C9" } as React.CSSProperties}
								/>
								Mobile app 2.0
							</span>
							<span className="faint">/</span>
							<span
								className="mono faint"
								style={{ fontSize: 11.5, padding: "0 6px" }}
							>
								MA-5
							</span>
							<span className="sp" />
							<span
								className={cn(
									"btn btn-sm",
									done ? "btn-secondary" : "btn-ghost",
								)}
								style={done ? { color: "var(--q-green)" } : undefined}
							>
								<span
									className={cn(
										done
											? "icon-[solar--check-circle-bold]"
											: "icon-[solar--check-circle-linear]",
										"size-3.5",
									)}
								/>
								<span>{done ? "Completed" : "Mark complete"}</span>
							</span>
							<span className="ibtn ibtn-sm">
								<span className="icon-[solar--close-circle-linear] size-4" />
							</span>
						</div>
						<div className="drawer-b">
							{done && (
								<div className="alert ok" style={{ marginBottom: 12 }}>
									<span className="i icon-[solar--check-circle-linear] size-[15px]" />
									<span>Completed just now.</span>
								</div>
							)}
							<textarea
								className="ttl-edit"
								rows={1}
								readOnly
								tabIndex={-1}
								value="Sync conflicts when two people edit"
							/>
							<dl className="kv" style={{ marginTop: 12 }}>
								{prop(
									"icon-[solar--record-circle-linear]",
									"Status",
									<span className="pillbtn">
										<StPill status={done ? "completed" : "todo"} />
									</span>,
								)}
								{prop(
									"icon-[solar--chart-2-linear]",
									"Priority",
									<span className="pillbtn">
										<PrPill p="urgent" />
									</span>,
								)}
								{prop(
									"icon-[solar--users-group-rounded-linear]",
									"Assignees",
									<span className="pillbtn">
										<AvStack people={[{ id: "l", name: "Leo Park" }]} />
									</span>,
								)}
							</dl>
							{pr && (
								<div className="dsec">
									<div className="dsec-h">
										<h3>Pull requests</h3>
									</div>
									<span
										className="row"
										style={{ gap: 8, padding: "6px 0", alignItems: "center" }}
									>
										<span className="icon-[simple-icons--github] size-4 shrink-0" />
										<span className="trunc grow">
											MA-5 Last write wins per field
										</span>
										<span className="faint" style={{ fontSize: 12 }}>
											#214
										</span>
										<span
											className={`badge ${pr === "merged" ? "violet" : "green"}`}
										>
											{pr === "merged" ? "Merged" : "Open"}
										</span>
									</span>
								</div>
							)}
							<div className="dsec">
								<div className="tabs" style={{ marginBottom: 6 }}>
									<span className="tab on">
										Comments<span className="cnt">{comments}</span>
									</span>
									<span className="tab">
										Activity<span className="cnt">{done ? 4 : 3}</span>
									</span>
								</div>
								{COMMENTS.slice(0, comments).map((c) => (
									<div key={c.id} className="cmt">
										<Av name={c.who} className="md" />
										<div className="body">
											<div className="who">
												<b>{c.who}</b>
												<time>{c.ago}</time>
											</div>
											<div className="txt">{c.text}</div>
										</div>
									</div>
								))}
							</div>
						</div>
					</aside>

					<div
						className="tst-root absolute bottom-6 left-6"
						style={{ width: Math.min(380, w - 48), height: 80, zIndex: 2 }}
					>
						<AnimatePresence>
							{toast && (
								<ToastCard
									key={round}
									t={SYNC_TOAST}
									layout={LAYOUT}
									paused={false}
									reduce={reduce}
									isBottom
									onHeight={() => {}}
									onClose={() => setToast(false)}
								/>
							)}
						</AnimatePresence>
					</div>
				</>
			)}
		</Stage>
	);
}
