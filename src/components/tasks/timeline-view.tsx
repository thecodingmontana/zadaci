import {
	addDays,
	differenceInCalendarDays,
	format,
	isSameDay,
	parseISO,
	startOfWeek,
} from "date-fns";
import { useEffect, useRef, useState } from "react";
import { projectColor } from "#/components/projects/bits";
import { Av } from "#/components/q/av";
import { StatusIcon } from "#/components/q/status-icon";
import type { TaskItem } from "#/graphql/operations";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { type GroupBy, groupTasks } from "#/lib/view-engine";
import { UnscheduledTray } from "./calendar-view";
import { useTaskView } from "./context";

// The Timeline view (reference views/timeline.js): a Gantt chart of tasks with dates,
// dependency arrows and milestones. Drag a bar sideways to move the task's dates.

type Milestone = {
	id: string;
	name: string;
	date: string;
	color?: string | null;
	project?: string;
};
type Zoom = "week" | "month";

const ROW = 36;
const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** How far along a task is: done, its subtasks, else its status (reference taskProg). */
const progress = (t: TaskItem) => {
	if (t.status === "completed") return 100;
	if (t.subtaskCount) return Math.round((t.subtaskDone / t.subtaskCount) * 100);
	return { idea: 0, todo: 5, in_progress: 45, in_review: 80 }[t.status] ?? 0;
};

export function useTimelineState(key: string, defaultGroup: GroupBy) {
	const storage = `zadaci:tl:${key}`;
	const [state, setState] = useState<{ zoom: Zoom; group: GroupBy }>({
		zoom: "week",
		group: defaultGroup,
	});
	useEffect(() => {
		try {
			const saved = localStorage.getItem(storage);
			if (saved) setState((s) => ({ ...s, ...JSON.parse(saved) }));
		} catch {}
	}, [storage]);
	const update = (patch: Partial<{ zoom: Zoom; group: GroupBy }>) =>
		setState((s) => {
			const next = { ...s, ...patch };
			try {
				localStorage.setItem(storage, JSON.stringify(next));
			} catch {}
			return next;
		});
	return [state, update] as const;
}

/** Zoom, grouping and "Today" for the toolbar (reference tlControls). */
export function TimelineControls({
	state,
	setState,
	onToday,
}: {
	state: { zoom: Zoom; group: GroupBy };
	setState: (patch: Partial<{ zoom: Zoom; group: GroupBy }>) => void;
	onToday: () => void;
}) {
	return (
		<>
			<div className="seg" style={{ marginLeft: 4 }}>
				{(
					[
						["week", "Weeks"],
						["month", "Months"],
					] as const
				).map(([k, n]) => (
					<button
						key={k}
						type="button"
						className={state.zoom === k ? "on" : ""}
						onClick={() => setState({ zoom: k })}
					>
						{n}
					</button>
				))}
			</div>
			<select
				className="select"
				style={{ height: 26, width: "auto", fontSize: 12, marginLeft: 4 }}
				aria-label="Group by"
				value={state.group}
				onChange={(e) => setState({ group: e.target.value as GroupBy })}
			>
				<option value="status">Group: Status</option>
				<option value="assignee">Group: Assignee</option>
				<option value="project">Group: Project</option>
				<option value="none">No grouping</option>
			</select>
			<button type="button" className="btn btn-ghost" onClick={onToday}>
				<span
					className="icon-[solar--target-linear] size-3.5"
					aria-hidden="true"
				/>
				Today
			</button>
		</>
	);
}

export function TimelineView({
	tasks,
	milestones,
	zoom,
	group,
	project,
	todayTick,
	onNew,
}: {
	tasks: TaskItem[];
	milestones: Milestone[];
	zoom: Zoom;
	group: GroupBy;
	/** a project's timeline (grouping by project falls back to status) */
	project?: string;
	/** bump to scroll back to today */
	todayTick: number;
	onNew?: () => void;
}) {
	const {
		members,
		projects,
		update,
		canEdit,
		openTask,
		member,
		project: projectOf,
	} = useTaskView();
	const right = useRef<HTMLDivElement>(null);
	const left = useRef<HTMLDivElement>(null);
	const today = new Date();
	const dw = zoom === "week" ? 32 : 11;
	const start = startOfWeek(addDays(today, zoom === "week" ? -21 : -56), {
		weekStartsOn: 1,
	});
	const nDays = zoom === "week" ? 7 * 13 : 7 * 34;
	const X = (day: string) =>
		differenceInCalendarDays(parseISO(day), start) * dw;
	const by = group === "project" && project ? "status" : group;
	const groups = groupTasks(
		tasks.filter((t) => t.dueDate),
		by,
		{ members, projects },
	).filter((g) => g.tasks.length);

	type Row =
		| { type: "ms" }
		| { type: "g"; name: string; n: number; icon?: React.ReactNode }
		| { type: "t"; t: TaskItem };
	const rows: Row[] = [];
	if (milestones.length) rows.push({ type: "ms" });
	for (const g of groups) {
		if (by !== "none")
			rows.push({
				type: "g",
				name: g.name,
				n: g.tasks.length,
				icon: g.set.status ? <StatusIcon status={g.set.status} /> : null,
			});
		for (const t of [...g.tasks].sort((a, b) =>
			(a.startDate ?? a.dueDate ?? "") > (b.startDate ?? b.dueDate ?? "")
				? 1
				: -1,
		))
			rows.push({ type: "t", t });
	}
	const H = rows.length * ROW;
	const W = nDays * dw;
	const rowY = new Map<string, number>();
	rows.forEach((r, i) => {
		if (r.type === "t") rowY.set(r.t.id, i * ROW + ROW / 2);
	});
	const todayX = differenceInCalendarDays(today, start) * dw;

	// open at today, and again when "Today" is pressed
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on zoom change and Today presses
	useEffect(() => {
		if (right.current) right.current.scrollLeft = Math.max(0, todayX - 160);
	}, [zoom, todayTick]);

	// tasks with no due date can't be drawn: list them so they don't silently vanish
	const tray = (
		<UnscheduledTray
			tasks={tasks.filter((t) => !t.dueDate && t.status !== "completed")}
			hint="Give one a due date to place it on the timeline."
			item={(t) => (
				<button
					key={t.id}
					type="button"
					className="cev"
					style={
						{
							"--c": projectColor(projectOf(t.projectId)?.color),
						} as React.CSSProperties
					}
					data-tip={t.name}
					onClick={() => openTask(t.id)}
				>
					<span className="trunc">{t.name}</span>
				</button>
			)}
		/>
	);

	if (!rows.length)
		return (
			<>
				{tray}
				<div className="empty-state">
					<div className="glyph">
						<span
							className="icon-[hugeicons--chart-gantt] size-5"
							aria-hidden="true"
						/>
					</div>
					<h2 className="es-h">Nothing on the timeline</h2>
					<p>Give tasks a start and due date to see them here.</p>
					{onNew && (
						<button
							type="button"
							className="btn btn-primary btn-sm"
							onClick={onNew}
						>
							<span
								className="icon-[hugeicons--plus-sign] size-3.5"
								aria-hidden="true"
							/>
							New task
						</button>
					)}
				</div>
			</>
		);

	const months: { d: Date; n: number }[] = [];
	for (let i = 0; i < nDays; i++) {
		const d = addDays(start, i);
		const last = months[months.length - 1];
		if (!last || last.d.getMonth() !== d.getMonth()) months.push({ d, n: 1 });
		else last.n++;
	}
	const span = (t: TaskItem) => {
		const due = t.dueDate as string;
		const s = t.startDate && t.startDate <= due ? t.startDate : due;
		return {
			s,
			x: X(s),
			w: Math.max(
				dw,
				(differenceInCalendarDays(parseISO(due), parseISO(s)) + 1) * dw,
			),
		};
	};

	return (
		<>
			{tray}
			<div className="tl">
				<div className="tl-left">
					<div className="tl-head">Task</div>
					<div className="tl-rows" ref={left}>
						{rows.map((r, i) => {
							if (r.type === "ms")
								return (
									// biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
									<div key={i} className="tl-row g">
										<span
											className="icon-[hugeicons--diamond-01] size-3"
											aria-hidden="true"
										/>
										Milestones
										<span className="faint" style={{ fontWeight: 500 }}>
											{milestones.length}
										</span>
									</div>
								);
							if (r.type === "g")
								return (
									// biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
									<div key={i} className="tl-row g">
										{r.icon}
										{r.name}
										<span className="faint" style={{ fontWeight: 500 }}>
											{r.n}
										</span>
									</div>
								);
							const m = member(r.t.assigneeId);
							return (
								<button
									key={r.t.id}
									type="button"
									className="tl-row"
									onClick={() => openTask(r.t.id)}
								>
									<StatusIcon status={r.t.status} size={13} />
									<span
										className="trunc grow"
										style={
											r.t.status === "completed"
												? { color: "var(--q-text-3)" }
												: undefined
										}
									>
										{r.t.name}
									</span>
									{!!r.t.subtaskCount && (
										<span className="faint num" style={{ fontSize: 11 }}>
											{r.t.subtaskDone}/{r.t.subtaskCount}
										</span>
									)}
									{m && <Av name={m.name} image={m.image} className="sm" />}
								</button>
							);
						})}
						<div style={{ height: 40 }} />
					</div>
				</div>
				<div
					className="tl-right"
					ref={right}
					onScroll={(e) => {
						if (left.current)
							left.current.scrollTop = e.currentTarget.scrollTop;
					}}
				>
					<div className="tl-head" style={{ width: W }}>
						<div className="tl-months">
							{months.map((m) => (
								<div key={m.d.toISOString()} style={{ width: m.n * dw }}>
									<span>{format(m.d, "MMMM yyyy")}</span>
								</div>
							))}
						</div>
						<div className="tl-days">
							{zoom === "week"
								? Array.from({ length: nDays }, (_, i) => {
										const d = addDays(start, i);
										return (
											<div
												key={iso(d)}
												style={{ width: dw }}
												className={isSameDay(d, today) ? "today" : undefined}
											>
												{format(d, "d")}
											</div>
										);
									})
								: Array.from({ length: nDays / 7 }, (_, i) => {
										const d = addDays(start, i * 7);
										return (
											<div key={iso(d)} style={{ width: dw * 7 }}>
												{format(d, "MMM d")}
											</div>
										);
									})}
						</div>
					</div>
					<div className="tl-grid" style={{ width: W, height: H + 40 }}>
						{zoom === "week" &&
							Array.from({ length: nDays }, (_, i) => {
								const d = addDays(start, i);
								return d.getDay() === 0 || d.getDay() === 6 ? (
									<div
										key={iso(d)}
										className="tl-we"
										style={{
											left: i * dw,
											width: dw,
											bottom: "auto",
											height: H,
										}}
									/>
								) : null;
							})}
						{Array.from({ length: nDays / 7 }, (_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: week gridlines by position
								key={i}
								className="tl-gl"
								style={{ left: i * 7 * dw, bottom: "auto", height: H }}
							/>
						))}
						<div
							className="tl-today"
							// the shading and lines stop at the last row, not in the scroll padding below
							style={{ left: todayX + dw / 2, bottom: "auto", height: H }}
							data-tip="Today"
						/>
						{rows.map((r, i) => {
							const y = i * ROW;
							if (r.type === "g")
								// biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
								return (
									<div key={i} className="tl-rowbg g" style={{ top: y }} />
								);
							if (r.type === "ms")
								return (
									// biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
									<div key={i}>
										<div className="tl-rowbg" style={{ top: y }} />
										<MilestoneLane
											milestones={milestones}
											X={X}
											dw={dw}
											y={y}
										/>
									</div>
								);
							const t = r.t;
							const { s, x, w } = span(t);
							const color =
								by === "status" || by === "none"
									? projectColor(projectOf(t.projectId)?.color)
									: `var(--q-st-${{ idea: "backlog", todo: "todo", in_progress: "progress", in_review: "review", completed: "done" }[t.status] ?? "todo"})`;
							return (
								<div key={t.id}>
									<div className="tl-rowbg" style={{ top: y }} />
									<Bar
										t={t}
										x={x}
										y={y}
										w={w}
										dw={dw}
										color={color}
										editable={canEdit(t.projectId)}
										title={`${t.name} · ${format(parseISO(s), "MMM d")} → ${format(parseISO(t.dueDate as string), "MMM d")}`}
										onOpen={() => openTask(t.id)}
										onMove={(days) => {
											const shift = (d: string | null) =>
												d ? iso(addDays(parseISO(d), days)) : null;
											update(t, {
												dueDate: shift(t.dueDate),
												startDate: shift(t.startDate),
											});
											toast.success(
												`Moved “${t.name}” ${Math.abs(days)} day${Math.abs(days) > 1 ? "s" : ""} ${days > 0 ? "later" : "earlier"}`,
												{ duration: 2200 },
											);
										}}
									>
										<span className="pf" style={{ width: `${progress(t)}%` }} />
										{w > 110 && (
											<>
												{member(t.assigneeId) && (
													<Av
														name={member(t.assigneeId)?.name ?? ""}
														image={member(t.assigneeId)?.image}
														className="sm"
													/>
												)}
												<span className="trunc">{t.name}</span>
											</>
										)}
									</Bar>
									{w <= 110 && (
										<div
											className="blabel"
											style={{ left: x + w + 6, top: y + 9 }}
										>
											{t.name}
										</div>
									)}
								</div>
							);
						})}
						<svg
							className="tl-deps"
							width={W}
							height={H}
							viewBox={`0 0 ${W} ${H}`}
							aria-hidden="true"
						>
							{tasks.flatMap((t) =>
								t.dependsOn
									.filter((d) => rowY.has(d) && rowY.has(t.id))
									.map((d) => {
										const a = tasks.find((x) => x.id === d);
										if (!a?.dueDate || !t.dueDate) return null;
										const x1 = X(a.dueDate) + dw;
										const y1 = rowY.get(d) as number;
										const x2 = span(t).x;
										const y2 = rowY.get(t.id) as number;
										const mx = Math.max(x1 + 10, x2 - 10);
										return (
											<g key={`${d}-${t.id}`}>
												<path
													d={`M${x1} ${y1} C ${mx} ${y1}, ${Math.min(x1 + 10, x2 - 10)} ${y2}, ${x2 - 1} ${y2}`}
													fill="none"
													stroke="var(--q-text-3)"
													strokeWidth="1.3"
													strokeDasharray={x2 < x1 ? "3 3" : undefined}
												/>
												<path
													d={`M${x2 - 6} ${y2 - 3.5} L${x2 - 1} ${y2} L${x2 - 6} ${y2 + 3.5}`}
													fill="none"
													stroke="var(--q-text-3)"
													strokeWidth="1.3"
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											</g>
										);
									}),
							)}
						</svg>
					</div>
				</div>
			</div>
		</>
	);
}

/** A bar you can drag sideways a whole day at a time; a plain click opens the task. */
function Bar({
	t,
	x,
	y,
	w,
	dw,
	color,
	editable,
	title,
	onOpen,
	onMove,
	children,
}: {
	t: TaskItem;
	x: number;
	y: number;
	w: number;
	dw: number;
	color: string;
	editable: boolean;
	title: string;
	onOpen: () => void;
	onMove: (days: number) => void;
	children: React.ReactNode;
}) {
	const [dx, setDx] = useState(0);
	const moved = useRef(false);
	return (
		<button
			type="button"
			className={cn(
				"bar",
				t.status === "completed" && "done",
				dx !== 0 && "dragging",
			)}
			style={
				{
					"--c": color,
					left: x + dx,
					top: y + 7,
					width: w,
				} as React.CSSProperties
			}
			data-tip={title}
			onPointerDown={(e) => {
				if (!editable || e.button !== 0) return;
				const x0 = e.clientX;
				moved.current = false;
				const move = (ev: PointerEvent) => {
					const d = ev.clientX - x0;
					if (Math.abs(d) > 4) moved.current = true;
					if (moved.current) setDx(Math.round(d / dw) * dw);
				};
				const up = (ev: PointerEvent) => {
					removeEventListener("pointermove", move);
					removeEventListener("pointerup", up);
					setDx(0);
					const days = Math.round((ev.clientX - x0) / dw);
					if (moved.current && days) onMove(days);
				};
				addEventListener("pointermove", move);
				addEventListener("pointerup", up);
			}}
			onClick={() => {
				if (!moved.current) onOpen();
			}}
		>
			{children}
		</button>
	);
}

/**
 * One diamond per date (same-day milestones merge); each label only uses the room up to the
 * next diamond, cramped ones show just the diamond, and the tooltip always has the full name.
 */
function MilestoneLane({
	milestones,
	X,
	dw,
	y,
}: {
	milestones: Milestone[];
	X: (day: string) => number;
	dw: number;
	y: number;
}) {
	const byDate = new Map<string, Milestone[]>();
	for (const m of milestones)
		byDate.set(m.date, [...(byDate.get(m.date) ?? []), m]);
	const pts = [...byDate.entries()]
		.sort(([a], [b]) => (a > b ? 1 : -1))
		.map(([date, list]) => ({ date, list, x: X(date) + dw / 2 }));
	return (
		<>
			{pts.map((pt, i) => {
				const next = pts[i + 1];
				const room = (next ? next.x : Number.POSITIVE_INFINITY) - pt.x - 24;
				const first = pt.list[0] as Milestone;
				const name =
					first.name + (pt.list.length > 1 ? ` +${pt.list.length - 1}` : "");
				const tip = `${pt.list.map((m) => m.name + (m.project ? ` (${m.project})` : "")).join(" · ")} · ${format(parseISO(pt.date), "MMM d")}`;
				return (
					<div
						key={pt.date}
						className="ms-w"
						style={{ left: pt.x - 6, top: y + 9 }}
						data-tip={tip}
						role="img"
						aria-label={`Milestone: ${tip}`}
					>
						<span
							className="ms"
							style={first.color ? { background: first.color } : undefined}
						/>
						{room >= 28 && (
							<span
								className="ms-l"
								style={{
									maxWidth: Number.isFinite(room) ? Math.round(room) : "none",
								}}
							>
								{name}
							</span>
						)}
					</div>
				);
			})}
		</>
	);
}
