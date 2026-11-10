import { motion } from "motion/react";
import { useRef, useState } from "react";
import { ProgBar } from "#/components/projects/bits";
import { AvStack } from "#/components/q/av";
import { StatusIcon } from "#/components/q/status-icon";
import { Due, Lbl, PrIcon } from "#/components/tasks/bits";
import { taskStatus } from "#/lib/tasks";
import { cn } from "#/lib/utils";
import { Stage, spot, useDemoLoop } from "./demo-stage";
import {
	CURSOR_PRESS_MS,
	CURSOR_TRAVEL_S,
	type Cursor,
	PlayerCursor,
} from "./multiplayer-text";

// The project board, drawn with the app's own board classes (src/ui.css .board/.bcol/.kcard)
// and task bits, playing what a teammate does in it: drag a card to Done, then add a task.

const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const; // the live cursors' travel curve
const LEO = { name: "Leo Park", color: "#3ecf8e" };

const day = (n: number) => {
	const d = new Date();
	d.setDate(d.getDate() + n);
	return d.toISOString().slice(0, 10);
};
const person = (name: string) => ({ id: name, name, image: null });

type DemoTask = {
	id: string;
	key: string;
	name: string;
	status: string;
	priority: string;
	labels: string[];
	due?: string;
	people: string[];
	comments?: number;
	sub?: [number, number];
};

const START: DemoTask[] = [
	{
		id: "2",
		key: "MA-2",
		name: "Push notification settings",
		status: "todo",
		priority: "medium",
		labels: ["backend"],
		due: day(11),
		people: ["Amara Osei"],
	},
	{
		id: "5",
		key: "MA-5",
		name: "Sync conflicts when two people edit",
		status: "todo",
		priority: "urgent",
		labels: ["backend"],
		due: day(3),
		people: ["Leo Park"],
	},
	{
		id: "1",
		key: "MA-1",
		name: "Offline mode for task lists",
		status: "in_progress",
		priority: "high",
		labels: ["frontend"],
		due: day(8),
		people: ["Maya Chen", "Leo Park"],
		comments: 2,
		sub: [2, 3],
	},
	{
		id: "4",
		key: "MA-4",
		name: "Dark mode polish on iPad",
		status: "in_progress",
		priority: "medium",
		labels: ["design"],
		due: day(6),
		people: ["Amara Osei"],
	},
	{
		id: "11",
		key: "MA-11",
		name: "Sign in with passkeys",
		status: "completed",
		priority: "high",
		labels: ["backend"],
		people: ["Leo Park"],
	},
];
const NEW_TITLE = "Widget for today's tasks";
const NEW: DemoTask = {
	id: "12",
	key: "MA-12",
	name: NEW_TITLE,
	status: "todo",
	priority: "none",
	labels: [],
	people: [],
};
const COLS = ["todo", "in_progress", "completed"];
const COL_W = 284;
/** where each column starts, less a little margin (board padding 24, gap 12) */
const COL_X = COLS.map((_, i) => 24 + i * (COL_W + 12) - 12);

/** One card, as the board's Card renders it for someone who can't edit (no hover actions). */
function DemoCard({ t, style }: { t: DemoTask; style?: React.CSSProperties }) {
	const done = t.status === "completed";
	return (
		<div className={cn("kcard", done && "done")} style={style}>
			{t.labels.length > 0 && (
				<div className="labels">
					{t.labels.map((id) => (
						<Lbl key={id} id={id} />
					))}
				</div>
			)}
			<div className="top">
				{done && (
					<span
						className="done-ic"
						style={{ margin: "2px 7px 0 0", display: "inline-flex" }}
					>
						<StatusIcon status="completed" />
					</span>
				)}
				<div className="title">{t.name}</div>
			</div>
			{t.sub && (
				<div className="subp">
					<span className="icon-[solar--checklist-minimalistic-linear] size-3" />
					<span className="num">
						{t.sub[0]}/{t.sub[1]}
					</span>
					<ProgBar
						value={Math.round((t.sub[0] / t.sub[1]) * 100)}
						tone={t.sub[0] === t.sub[1] ? "green" : undefined}
					/>
				</div>
			)}
			<div className="meta">
				<span className="key">{t.key}</span>
				<span className="m">
					<PrIcon p={t.priority} size={13} />
				</span>
				{t.due && (
					<span className="m">
						<Due day={t.due} status={t.status} />
					</span>
				)}
				{!!t.comments && (
					<span className="m">
						<span className="icon-[solar--chat-round-line-linear] size-3" />
						{t.comments}
					</span>
				)}
				<span className="m" style={{ marginLeft: "auto" }}>
					{t.people.length ? (
						<AvStack people={t.people.map(person)} max={3} />
					) : (
						<span
							className="av sm"
							style={{ "--c": "var(--q-gray)" } as React.CSSProperties}
						/>
					)}
				</span>
			</div>
		</div>
	);
}

type Drag = { task: DemoTask; x: number; y: number; w: number; over?: string };

export function BoardDemo() {
	const stage = useRef<HTMLDivElement>(null);
	const [tasks, setTasks] = useState(START);
	const [drag, setDrag] = useState<Drag | null>(null);
	const [cursor, setCursor] = useState<Cursor | null>(null);
	const [pressing, setPressing] = useState(false);
	const [composer, setComposer] = useState<string | null>(null);
	// on a phone the board shows a column and a bit, and scrolls to where the action is
	const [pan, setPan] = useState(COL_X[1]);

	const at = (sel: string) =>
		spot(stage.current, stage.current?.querySelector(sel));
	const point = (
		r: { x: number; y: number; w: number; h: number },
		fx = 0.55,
		fy = 0.6,
	): Cursor => ({
		x: r.x + r.w * fx - 11,
		y: r.y + r.h * fy - 3,
		rot: -8,
	});

	const reduce = useDemoLoop(
		stage,
		async (wait) => {
			await wait(900);
			// a teammate picks up MA-1 …
			const card = at('[data-id="1"]');
			if (!card) return;
			setCursor(point(card));
			await wait(CURSOR_TRAVEL_S * 1000 + 120);
			setPressing(true);
			await wait(CURSOR_PRESS_MS);
			setDrag({ task: START[2], x: card.x, y: card.y, w: card.w });
			// … and drags it to the top of Done
			const target = at('[data-col="completed"] .bcol-b');
			if (!target) return;
			const to = { x: target.x + 8, y: target.y + 4 };
			setDrag((d) => d && { ...d, ...to, over: "completed" });
			setPan(COL_X[2]);
			setCursor({
				x: to.x + card.w * 0.55 - 11,
				y: to.y + card.h * 0.6 - 3,
				rot: -4,
			});
			await wait(CURSOR_TRAVEL_S * 1000 + 80);
			setPressing(false);
			setDrag(null);
			setTasks((ts) => [
				{ ...START[2], status: "completed" },
				...ts.filter((t) => t.id !== "1"),
			]);
			await wait(1100);
			// then adds a task with the composer at the bottom of To Do
			setPan(0);
			await wait(CURSOR_TRAVEL_S * 1000);
			const add = at('[data-col="todo"] .addcard');
			if (!add) return;
			setCursor(point(add, 0.3, 0.6));
			await wait(CURSOR_TRAVEL_S * 1000 + 120);
			setPressing(true);
			await wait(CURSOR_PRESS_MS);
			setPressing(false);
			setComposer("");
			setCursor((c) => c && { ...c, y: c.y + 70, x: c.x + 150 });
			for (let i = 1; i <= NEW_TITLE.length; i++) {
				await wait(45);
				setComposer(NEW_TITLE.slice(0, i));
			}
			await wait(350);
			// Enter: the card shows at once, its key arrives with the server's answer
			setComposer("");
			setTasks((ts) => [...ts, { ...NEW, key: "" }]);
			await wait(420);
			setTasks((ts) => ts.map((t) => (t.id === "12" ? NEW : t)));
			await wait(2600);
			setCursor(null);
			await wait(900);
		},
		() => {
			setTasks(START);
			setDrag(null);
			setComposer(null);
			setPressing(false);
			setPan(COL_X[1]);
		},
		() => {
			setTasks([
				{ ...START[2], status: "completed" },
				...START.filter((t) => t.id !== "1"),
				NEW,
			]);
			setCursor(null);
		},
	);

	return (
		<Stage
			width={940}
			height={430}
			label="A Zadaci board: a teammate drags a task to Done, then adds a new one"
			stageRef={stage}
			pan={pan}
		>
			<div className="board" style={{ height: "100%", overflow: "hidden" }}>
				{COLS.map((col) => {
					const cards = tasks.filter((t) => t.status === col);
					return (
						<section
							key={col}
							data-col={col}
							className={cn("bcol", drag?.over === col && "over")}
							style={{ width: COL_W }}
						>
							<div className="bcol-h">
								<StatusIcon status={col} />
								<span>{taskStatus(col).name}</span>
								<span className="cnt">{cards.length}</span>
								<span className="acts">
									<span className="ibtn ibtn-xs">
										<span className="icon-[hugeicons--plus-sign] size-3.5" />
									</span>
									<span className="ibtn ibtn-xs">
										<span className="icon-[solar--menu-dots-bold] size-3.5" />
									</span>
								</span>
							</div>
							<div className="bcol-b">
								{cards.map((t) => (
									<div
										key={t.id}
										data-id={t.id}
										style={{
											opacity: drag?.task.id === t.id ? 0.35 : undefined,
										}}
									>
										<DemoCard t={t} />
									</div>
								))}
								{col === "todo" && composer !== null ? (
									<div className="composer">
										<textarea
											placeholder="Task name"
											rows={2}
											value={composer}
											readOnly
											tabIndex={-1}
										/>
										<div className="row">
											<span className="faint" style={{ fontSize: 11 }}>
												Enter to add · Esc to close
											</span>
											<span className="sp" />
											<span className="btn btn-sm btn-ghost">Done</span>
											<span className="btn btn-sm btn-primary">Add</span>
										</div>
									</div>
								) : (
									<span className="addcard">
										<span className="icon-[hugeicons--plus-sign] size-3.5" />
										Add task
									</span>
								)}
							</div>
						</section>
					);
				})}
			</div>
			{drag && (
				// the drag overlay: the card lifted with the pop shadow, following the pointer
				<motion.div
					className="absolute top-0 left-0"
					style={{ width: drag.w }}
					initial={{ transform: `translate(${drag.x}px, ${drag.y}px)` }}
					animate={{ transform: `translate(${drag.x}px, ${drag.y}px)` }}
					transition={{ duration: CURSOR_TRAVEL_S, ease: EASE_IN_OUT }}
				>
					<DemoCard
						t={drag.task}
						style={{ boxShadow: "var(--q-shadow-pop)", cursor: "grabbing" }}
					/>
				</motion.div>
			)}
			<div className="pointer-events-none absolute inset-0">
				<PlayerCursor
					player={LEO}
					cursor={cursor}
					pressing={pressing}
					reduce={reduce}
				/>
			</div>
		</Stage>
	);
}
