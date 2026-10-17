import { StatusIcon } from "#/components/q/status-icon";
import { TASK_STATUSES } from "#/lib/tasks";

// Placeholders shaped like the task views while their tasks load (reference shell/skeletons.js).
// Only what is loading gets a placeholder: column names, weekdays and the toolbar are real.

export function Sk({
	w,
	h = 10,
	r,
}: {
	w: string | number;
	h?: number;
	r?: string | number;
}) {
	return (
		<span className="sk" style={{ width: w, height: h, borderRadius: r }} />
	);
}

/** The view toolbar, inert until the tasks arrive. */
export function ToolbarSkeleton() {
	return (
		<div className="toolbar" aria-hidden="true">
			<div className="inwrap">
				<span
					className="i icon-[solar--magnifer-linear] size-[13px]"
					aria-hidden="true"
				/>
				<input
					className="input search-sm"
					placeholder="Search tasks"
					disabled
					tabIndex={-1}
				/>
			</div>
			<span className="btn btn-ghost" style={{ pointerEvents: "none" }}>
				<span
					className="icon-[hugeicons--filter] size-3.5"
					aria-hidden="true"
				/>
				Filter
			</span>
			<span className="btn btn-ghost" style={{ pointerEvents: "none" }}>
				<span
					className="icon-[solar--sort-vertical-linear] size-3.5"
					aria-hidden="true"
				/>
				<Sk w={60} />
			</span>
		</div>
	);
}

export function ListSkeleton({ rows = 10 }: { rows?: number }) {
	return (
		<div style={{ padding: "12px 20px" }}>
			{Array.from({ length: rows }, (_, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder rows never reorder
					key={i}
					className="row"
					style={{
						height: 40,
						borderBottom: "1px solid var(--q-divider)",
						gap: 12,
						padding: "0 8px",
					}}
				>
					<Sk w={15} h={15} r={4} />
					<Sk w={`${38 + ((i * 13) % 30)}%`} />
					<span className="sp" />
					<Sk w={70} h={18} r={5} />
					<Sk w={22} h={22} r="50%" />
					<Sk w={54} />
				</div>
			))}
		</div>
	);
}

export function BoardSkeleton() {
	const cards = [3, 4, 3, 2, 3];
	return (
		<div className="board">
			{TASK_STATUSES.map((s, c) => (
				<section key={s.id} className="bcol" aria-label={s.name}>
					<div className="bcol-h">
						<StatusIcon status={s.id} />
						<span>{s.name}</span>
					</div>
					<div className="bcol-b">
						{Array.from({ length: cards[c] ?? 2 }, (_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder cards never reorder
							<div key={i} className="kcard" style={{ cursor: "default" }}>
								<Sk w="40%" h={14} r={5} />
								<Sk w={`${(60 + i * 9) % 95}%`} />
								<div className="row">
									<Sk w={40} h={9} />
									<Sk w={30} h={9} />
									<span className="sp" />
									<Sk w={18} h={18} r="50%" />
								</div>
							</div>
						))}
					</div>
				</section>
			))}
		</div>
	);
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarSkeleton() {
	return (
		<div className="cal" style={{ minHeight: 640 }}>
			<div className="toolbar" style={{ gap: 8 }}>
				<Sk w={56} h={26} r={6} />
				<Sk w={140} h={16} />
			</div>
			<div className="cal-h">
				{WEEKDAYS.map((d) => (
					<div key={d}>{d}</div>
				))}
			</div>
			<div
				className="cal-g"
				style={{ gridTemplateRows: "repeat(5,minmax(112px,1fr))" }}
			>
				{Array.from({ length: 35 }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder days never reorder
					<div key={i} className="cday">
						<Sk w={14} h={10} />
						{i % 4 === 1 && <Sk w="80%" h={16} r={4} />}
						{i % 7 === 3 && <Sk w="60%" h={16} r={4} />}
					</div>
				))}
			</div>
		</div>
	);
}

export function TimelineSkeleton() {
	return (
		<div style={{ padding: "12px 20px" }}>
			{Array.from({ length: 8 }, (_, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder rows never reorder
					key={i}
					className="row"
					style={{
						height: 38,
						borderBottom: "1px solid var(--q-divider)",
						gap: 12,
					}}
				>
					<span style={{ width: 200, flexShrink: 0 }}>
						<Sk w={`${50 + ((i * 17) % 40)}%`} />
					</span>
					<span style={{ width: `${8 + ((i * 11) % 30)}%` }} />
					<Sk w={`${10 + ((i * 7) % 25)}%`} h={18} r={5} />
				</div>
			))}
		</div>
	);
}

/** The task area for one layout. */
export function TaskViewSkeleton({ type }: { type: string }) {
	if (type === "board") return <BoardSkeleton />;
	if (type === "calendar") return <CalendarSkeleton />;
	if (type === "timeline") return <TimelineSkeleton />;
	return <ListSkeleton />;
}
