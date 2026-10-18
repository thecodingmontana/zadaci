import {
	DndContext,
	type DragEndEvent,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	addDays,
	addMonths,
	addWeeks,
	differenceInCalendarDays,
	format,
	isSameDay,
	isSameMonth,
	parseISO,
	startOfMonth,
	startOfWeek,
} from "date-fns";
import { useEffect, useState } from "react";
import { projectColor } from "#/components/projects/bits";
import { Av } from "#/components/q/av";
import { StatusIcon } from "#/components/q/status-icon";
import type { TaskItem } from "#/graphql/operations";
import { cn } from "#/lib/utils";
import { PrIcon } from "./bits";
import { useTaskView } from "./context";
import { useCanCreateTask, useNewTask } from "./new-task";
import { PickPopover } from "./pick";

// The Calendar view (reference views/calendar.js): tasks on their due dates by month or
// week. Drag a task to another day to reschedule it; its start date moves with it.

const day = (d: Date) => format(d, "yyyy-MM-dd");

export function CalendarView({
	tasks,
	projectId,
	storageKey,
	weekStartsOn = 1,
}: {
	tasks: TaskItem[];
	/** a project's calendar: new tasks go there and the legend hides */
	projectId?: string;
	storageKey: string;
	weekStartsOn?: 0 | 1;
}) {
	const { update, canEdit, project } = useTaskView();
	const newTask = useNewTask();
	const canCreate = useCanCreateTask();
	const canAdd = projectId ? canEdit(projectId) : canCreate;
	const [cursor, setCursor] = useState(() => new Date());
	const [mode, setMode] = useState<"month" | "week">("month");
	useEffect(() => {
		try {
			const saved = localStorage.getItem(`zadaci:cal:${storageKey}`);
			if (saved === "week" || saved === "month") setMode(saved);
		} catch {}
	}, [storageKey]);
	const pickMode = (m: "month" | "week") => {
		setMode(m);
		try {
			localStorage.setItem(`zadaci:cal:${storageKey}`, m);
		} catch {}
	};
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
	);
	const onDay = (d: Date) => tasks.filter((t) => t.dueDate === day(d));
	const step = (n: number) =>
		setCursor((c) => (mode === "month" ? addMonths(c, n) : addWeeks(c, n)));

	function onDragEnd({ active, over }: DragEndEvent) {
		const t = tasks.find((x) => x.id === active.id);
		const to = over?.id ? String(over.id) : null;
		if (!t || !to || t.dueDate === to) return;
		const len =
			t.startDate && t.dueDate
				? differenceInCalendarDays(parseISO(t.dueDate), parseISO(t.startDate))
				: null;
		update(t, {
			dueDate: to,
			...(len !== null && { startDate: day(addDays(parseISO(to), -len)) }),
		});
	}

	let label: string;
	let body: React.ReactNode;
	const today = new Date();
	if (mode === "month") {
		label = format(cursor, "MMMM yyyy");
		const start = startOfWeek(startOfMonth(cursor), { weekStartsOn });
		const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
		const shown =
			cells[35] && !isSameMonth(cells[35], cursor) ? cells.slice(0, 35) : cells;
		body = (
			<>
				<div className="cal-h">
					{shown.slice(0, 7).map((d) => (
						<div key={d.toISOString()}>{format(d, "EEE")}</div>
					))}
				</div>
				<div
					className="cal-g"
					style={{
						gridTemplateRows: `repeat(${shown.length / 7},minmax(112px,1fr))`,
					}}
				>
					{shown.map((d) => {
						const items = onDay(d);
						return (
							<Day
								key={d.toISOString()}
								date={d}
								out={!isSameMonth(d, cursor)}
								today={isSameDay(d, today)}
							>
								{canAdd && (
									<button
										type="button"
										className="ibtn ibtn-xs add"
										aria-label={`Add task on ${format(d, "MMM d")}`}
										onClick={() => newTask({ projectId, dueDate: day(d) })}
									>
										<span
											className="icon-[hugeicons--plus-sign] size-[13px]"
											aria-hidden="true"
										/>
									</button>
								)}
								{items.slice(0, 3).map((t) => (
									<Chip key={t.id} t={t} />
								))}
								{items.length > 3 && <More date={d} items={items} />}
							</Day>
						);
					})}
				</div>
			</>
		);
	} else {
		const start = startOfWeek(cursor, { weekStartsOn });
		const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
		label = `${format(days[0] as Date, "MMM d")} – ${format(days[6] as Date, "MMM d")}, ${format(days[6] as Date, "yyyy")}`;
		body = (
			<div className="week">
				{days.map((d) => {
					const items = onDay(d);
					return (
						<div key={d.toISOString()} className="wcol">
							<div className={cn("wcol-h", isSameDay(d, today) && "today")}>
								<span className="n">{format(d, "d")}</span>
								<span className="muted" style={{ fontSize: 12 }}>
									{format(d, "EEE")}
								</span>
								<span className="sp" />
								{canAdd && (
									<button
										type="button"
										className="ibtn ibtn-xs"
										aria-label="Add task"
										onClick={() => newTask({ projectId, dueDate: day(d) })}
									>
										<span
											className="icon-[hugeicons--plus-sign] size-[13px]"
											aria-hidden="true"
										/>
									</button>
								)}
							</div>
							<WeekBody date={d}>
								{items.length ? (
									items.map((t) => <WeekCard key={t.id} t={t} />)
								) : (
									<span className="faint" style={{ fontSize: 12, padding: 4 }}>
										No tasks
									</span>
								)}
							</WeekBody>
						</div>
					);
				})}
			</div>
		);
	}

	const legend = projectId
		? []
		: [...new Set(tasks.map((t) => t.projectId))]
				.map((id) => project(id))
				.filter((p) => !!p);

	return (
		<DndContext sensors={sensors} onDragEnd={onDragEnd}>
			<div className="cal" style={{ minHeight: 640 }}>
				<div className="toolbar" style={{ gap: 8 }}>
					<button
						type="button"
						className="btn btn-secondary btn-sm"
						onClick={() => setCursor(new Date())}
					>
						Today
					</button>
					<div className="row" style={{ gap: 0 }}>
						<button
							type="button"
							className="ibtn ibtn-sm"
							aria-label="Previous"
							onClick={() => step(-1)}
						>
							<span
								className="icon-[solar--alt-arrow-left-linear] size-4"
								aria-hidden="true"
							/>
						</button>
						<button
							type="button"
							className="ibtn ibtn-sm"
							aria-label="Next"
							onClick={() => step(1)}
						>
							<span
								className="icon-[solar--alt-arrow-right-linear] size-4"
								aria-hidden="true"
							/>
						</button>
					</div>
					<h2
						style={{
							fontSize: 15,
							fontWeight: 600,
							margin: "0 4px",
							letterSpacing: "-.01em",
						}}
						aria-live="polite"
					>
						{label}
					</h2>
					<span className="sp" />
					{legend.length > 1 && (
						<span
							className="row hide-m"
							style={{
								gap: 10,
								fontSize: 11.5,
								color: "var(--q-text-2)",
								marginRight: 8,
							}}
						>
							{legend.slice(0, 5).map((p) => (
								<span key={p.id} className="row" style={{ gap: 4 }}>
									<span
										className="pdot"
										style={
											{ "--c": projectColor(p.color) } as React.CSSProperties
										}
									/>
									{p.title}
								</span>
							))}
						</span>
					)}
					<div className="seg">
						{(["month", "week"] as const).map((m) => (
							<button
								key={m}
								type="button"
								className={mode === m ? "on" : ""}
								onClick={() => pickMode(m)}
							>
								{m === "month" ? "Month" : "Week"}
							</button>
						))}
					</div>
				</div>
				<UnscheduledTray
					tasks={tasks.filter((t) => !t.dueDate && t.status !== "completed")}
					hint="Drag one onto a day to schedule it."
					item={(t) => <Chip key={t.id} t={t} />}
				/>
				{body}
			</div>
		</DndContext>
	);
}

/**
 * Open tasks with no date, which a calendar or timeline can't place: listed so they don't
 * silently disappear. `item` draws each one (the calendar's are draggable onto days).
 */
export function UnscheduledTray({
	tasks,
	hint,
	item,
}: {
	tasks: TaskItem[];
	hint: string;
	item: (t: TaskItem) => React.ReactNode;
}) {
	if (!tasks.length) return null;
	return (
		<details className="unsched" open={tasks.length <= 12}>
			<summary>
				Unscheduled <span className="faint">· {tasks.length}</span>
				<span className="faint hide-m" style={{ fontWeight: 400 }}>
					{" "}
					— {hint}
				</span>
			</summary>
			<div className="unsched-list">{tasks.map(item)}</div>
		</details>
	);
}

function Day({
	date,
	out,
	today,
	children,
}: {
	date: Date;
	out: boolean;
	today: boolean;
	children: React.ReactNode;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: day(date) });
	return (
		<div
			ref={setNodeRef}
			className={cn("cday", out && "out", today && "today", isOver && "over")}
		>
			<span className="dn" aria-current={today ? "date" : undefined}>
				{format(date, "d")}
			</span>
			{children}
		</div>
	);
}

function WeekBody({
	date,
	children,
}: {
	date: Date;
	children: React.ReactNode;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: day(date) });
	return (
		<div ref={setNodeRef} className={cn("wcol-b", isOver && "over")}>
			{children}
		</div>
	);
}

/** Dragging is only for people who can edit the task. */
function useDrag(t: TaskItem) {
	const { canEdit } = useTaskView();
	const { attributes, listeners, setNodeRef, transform, isDragging } =
		useDraggable({
			id: t.id,
			disabled: !canEdit(t.projectId),
		});
	return {
		ref: setNodeRef,
		props: { ...attributes, ...listeners },
		style: {
			transform: transform
				? `translate(${transform.x}px, ${transform.y}px)`
				: undefined,
			zIndex: isDragging ? 5 : undefined,
			opacity: isDragging ? 0.8 : undefined,
		} as React.CSSProperties,
	};
}

function Chip({ t }: { t: TaskItem }) {
	const { openTask, project, member } = useTaskView();
	const drag = useDrag(t);
	const m = member(t.assigneeId);
	const done = t.status === "completed";
	return (
		<button
			ref={drag.ref}
			type="button"
			className={cn("cev", done && "done")}
			style={
				{
					"--c": projectColor(project(t.projectId)?.color),
					...drag.style,
				} as React.CSSProperties
			}
			title={t.name}
			{...drag.props}
			onClick={() => openTask(t.id)}
		>
			{done ? (
				<StatusIcon status="completed" size={11} />
			) : (
				<PrIcon p={t.priority} size={11} />
			)}
			<span className="trunc">{t.name}</span>
			{m && <Av name={m.name} image={m.image} />}
		</button>
	);
}

function WeekCard({ t }: { t: TaskItem }) {
	const { openTask, project, member } = useTaskView();
	const drag = useDrag(t);
	const p = project(t.projectId);
	const m = member(t.assigneeId);
	const color = projectColor(p?.color);
	return (
		<button
			ref={drag.ref}
			type="button"
			className="wcard"
			style={{ "--c": color, ...drag.style } as React.CSSProperties}
			{...drag.props}
			onClick={() => openTask(t.id)}
		>
			<span
				className="t"
				style={
					t.status === "completed"
						? { textDecoration: "line-through", color: "var(--q-text-3)" }
						: undefined
				}
			>
				<span
					className="pdot"
					style={{ "--c": color } as React.CSSProperties}
				/>
				{t.name}
			</span>
			<span className="m">
				<StatusIcon status={t.status} size={11} />
				<PrIcon p={t.priority} size={11} />
				<span className="trunc grow">{p?.title}</span>
				{m && <Av name={m.name} image={m.image} className="sm" />}
			</span>
		</button>
	);
}

/** "+3 more" opens the day's full list (reference daylist popover). */
function More({ date, items }: { date: Date; items: TaskItem[] }) {
	const { openTask } = useTaskView();
	return (
		<PickPopover
			width={260}
			trigger={
				<button type="button" className="cmore">
					+{items.length - 3} more
				</button>
			}
		>
			<div className="mh">{format(date, "EEEE, MMM d")}</div>
			{items.map((t) => (
				<button
					key={t.id}
					type="button"
					className="mi"
					onClick={() => openTask(t.id)}
				>
					<StatusIcon status={t.status} />
					<span className="trunc">{t.name}</span>
					<span className="r mono">{t.key}</span>
				</button>
			))}
		</PickPopover>
	);
}
