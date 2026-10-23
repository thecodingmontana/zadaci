import { StatusIcon } from "#/components/q/status-icon";
import { isClosed, label as labelOf, priority, taskStatus } from "#/lib/tasks";
import { daysUntil, relDay } from "#/lib/time";
import { cn } from "#/lib/utils";

// Small task pieces from the reference helpers (prIcon, stPill, prPill, lbl, dueHtml).

/** Priority glyph: red alert for urgent, dashes for none, else 1–3 bars. */
export function PrIcon({ p, size = 14 }: { p: string; size?: number }) {
	const svg = (children: React.ReactNode) => (
		<svg
			width={size}
			height={size}
			viewBox="0 0 14 14"
			aria-hidden="true"
			className="shrink-0"
		>
			{children}
		</svg>
	);
	if (p === "urgent")
		return svg(
			<>
				<rect x="1" y="1" width="12" height="12" rx="3" fill="var(--q-red)" />
				<path
					d="M7 3.8v4"
					stroke="#fff"
					strokeWidth="1.7"
					strokeLinecap="round"
				/>
				<circle cx="7" cy="10.1" r=".95" fill="#fff" />
			</>,
		);
	if (!p || p === "none")
		return svg(
			<path
				d="M2.5 7h2M6 7h2M9.5 7h2"
				stroke="var(--q-text-3)"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>,
		);
	const w = priority(p).w;
	const bar = (x: number, h: number, on: boolean) => (
		<rect
			x={x}
			y={12 - h}
			width="2.6"
			height={h}
			rx="1"
			fill={on ? "var(--q-text-2)" : "var(--q-border-strong)"}
		/>
	);
	return svg(
		<>
			{bar(1.8, 4.5, w >= 1)}
			{bar(5.7, 7.5, w >= 2)}
			{bar(9.6, 10.5, w >= 3)}
		</>,
	);
}

export const StPill = ({ status }: { status: string }) => (
	<>
		<StatusIcon status={status} />
		<span>{taskStatus(status).name}</span>
	</>
);

export const PrPill = ({ p }: { p: string }) => (
	<>
		<PrIcon p={p} />
		<span>{priority(p).name}</span>
	</>
);

export function Lbl({ id }: { id: string }) {
	const l = labelOf(id);
	if (!l) return null;
	return (
		<span className="lbl" style={{ "--c": l.c } as React.CSSProperties}>
			<i />
			{l.name}
		</span>
	);
}

/** Due date coloured by urgency: red when overdue, amber when due within a day. */
export function Due({
	day,
	status,
	icon = true,
}: {
	day: string | null;
	status: string;
	icon?: boolean;
}) {
	if (!day) return null;
	const n = daysUntil(day);
	const tone = isClosed(status) ? "" : n < 0 ? "over" : n <= 1 ? "soon" : "";
	return (
		<span className={cn("due", tone)} suppressHydrationWarning>
			{icon && (
				<span
					className="icon-[solar--calendar-linear] size-3"
					aria-hidden="true"
				/>
			)}
			{relDay(day)}
		</span>
	);
}

/** Shown when tasks exist but none match the search or filters. */
export function NoResults({ onClear }: { onClear: () => void }) {
	return (
		<div className="empty-state">
			<div className="glyph">
				<span
					className="icon-[solar--magnifer-bug-linear] size-5"
					aria-hidden="true"
				/>
			</div>
			<h2 className="es-h">No results found</h2>
			<p>No tasks match this search or these filters.</p>
			<button
				type="button"
				className="btn btn-secondary btn-sm"
				onClick={onClear}
			>
				Clear search and filters
			</button>
		</div>
	);
}
