import {
	addDays,
	addMonths,
	format,
	isSameDay,
	isSameMonth,
	parseISO,
	startOfMonth,
	startOfWeek,
} from "date-fns";
import { Popover } from "radix-ui";
import { type ReactNode, useState } from "react";
import { projectColor } from "#/components/projects/bits";
import { Av } from "#/components/q/av";
import { StatusIcon } from "#/components/q/status-icon";
import { PRIORITIES, TASK_STATUSES } from "#/lib/tasks";
import { cn } from "#/lib/utils";
import { PrIcon } from "./bits";

// Task pickers ported from the reference popovers: a searchable list (popList) and a
// date picker (quick picks + miniCal), on Radix Popover for focus and dismissal.

export type PickItem = {
	id: string;
	name: string;
	icon?: ReactNode;
	on?: boolean;
	kbd?: string;
};

/** Popover shell with the reference .pop look. */
export function PickPopover({
	trigger,
	children,
	open,
	onOpenChange,
	width,
	align = "start",
}: {
	trigger: ReactNode;
	children: ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	width?: number;
	align?: "start" | "center" | "end";
}) {
	return (
		<Popover.Root open={open} onOpenChange={onOpenChange}>
			<Popover.Trigger asChild>{trigger}</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content
					className="pop enter"
					align={align}
					sideOffset={4}
					collisionPadding={8}
					style={{ position: "relative", width, zIndex: 80 }}
					onClick={(e) => e.stopPropagation()}
				>
					{children}
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}

/** Arrow keys move between options, like the reference menus. */
function onListKey(e: React.KeyboardEvent<HTMLDivElement>) {
	if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
	const items = [
		...e.currentTarget.querySelectorAll<HTMLElement>(
			".mi:not([aria-disabled])",
		),
	];
	if (!items.length) return;
	e.preventDefault();
	const i = items.indexOf(document.activeElement as HTMLElement);
	const next =
		e.key === "ArrowDown"
			? (i + 1) % items.length
			: (i - 1 + items.length) % items.length;
	items[next]?.focus();
}

/** Searchable option list (reference popList). `multi` keeps it open and toggles. */
export function PickList({
	items,
	onPick,
	search,
	empty = "No matches",
}: {
	items: PickItem[];
	onPick: (id: string) => void;
	search?: string;
	empty?: string;
}) {
	const [q, setQ] = useState("");
	const list = items.filter(
		(it) => !q || it.name.toLowerCase().includes(q.toLowerCase()),
	);
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: arrow-key handling for the option list
		<div onKeyDown={onListKey}>
			{search && (
				<div className="pin">
					<input
						placeholder={search}
						aria-label={search}
						value={q}
						onChange={(e) => setQ(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && list[0]) onPick(list[0].id);
						}}
						// biome-ignore lint/a11y/noAutofocus: the picker opens to type straight away
						autoFocus
					/>
				</div>
			)}
			<div role="menu">
				{list.length ? (
					list.map((it) => (
						<button
							key={it.id}
							type="button"
							className="mi"
							role="menuitemradio"
							aria-checked={!!it.on}
							onClick={() => onPick(it.id)}
						>
							{it.icon}
							<span className="trunc">{it.name}</span>
							{it.kbd && (
								<span className="r">
									<kbd>{it.kbd}</kbd>
								</span>
							)}
							{it.on && (
								<span className="ck">
									<span
										className="icon-[hugeicons--tick-02] size-3.5"
										aria-hidden="true"
									/>
								</span>
							)}
						</button>
					))
				) : (
					<div className="mi faint" style={{ cursor: "default" }} aria-disabled>
						{empty}
					</div>
				)}
			</div>
		</div>
	);
}

/** A picker that closes after one choice. */
function SinglePick({
	trigger,
	items,
	onPick,
	search,
	width = 220,
}: {
	trigger: ReactNode;
	items: PickItem[];
	onPick: (id: string) => void;
	search?: string;
	width?: number;
}) {
	const [open, setOpen] = useState(false);
	return (
		<PickPopover
			trigger={trigger}
			open={open}
			onOpenChange={setOpen}
			width={width}
		>
			<PickList
				items={items}
				search={search}
				onPick={(id) => {
					setOpen(false);
					onPick(id);
				}}
			/>
		</PickPopover>
	);
}

export function StatusPick({
	value,
	onPick,
	children,
}: {
	value: string;
	onPick: (status: string) => void;
	children: ReactNode;
}) {
	return (
		<SinglePick
			trigger={children}
			onPick={onPick}
			items={TASK_STATUSES.map((s, i) => ({
				id: s.id,
				name: s.name,
				icon: <StatusIcon status={s.id} />,
				on: value === s.id,
				kbd: String(i + 1),
			}))}
		/>
	);
}

export function PriorityPick({
	value,
	onPick,
	children,
}: {
	value: string;
	onPick: (priority: string) => void;
	children: ReactNode;
}) {
	return (
		<SinglePick
			trigger={children}
			onPick={onPick}
			items={PRIORITIES.map((p) => ({
				id: p.id,
				name: p.name,
				icon: <PrIcon p={p.id} />,
				on: value === p.id,
			}))}
		/>
	);
}

export type Person = {
	id: string;
	name: string;
	image: string | null;
	isMe?: boolean;
	role?: string;
};

export function AssigneePick({
	value,
	people,
	onPick,
	children,
	search = "Assign to…",
}: {
	value: string | null;
	people: Person[];
	onPick: (memberId: string | null) => void;
	children: ReactNode;
	search?: string;
}) {
	return (
		<SinglePick
			trigger={children}
			search={search}
			width={240}
			onPick={(id) => onPick(id || null)}
			items={[
				{
					id: "",
					name: "Unassigned",
					icon: (
						<span
							className="av sm"
							style={{ "--c": "var(--q-gray)" } as React.CSSProperties}
						/>
					),
					on: !value,
				},
				...people.map((m) => ({
					id: m.id,
					name: m.isMe ? `${m.name} (you)` : m.name,
					icon: <Av name={m.name} image={m.image} className="sm" />,
					on: value === m.id,
				})),
			]}
		/>
	);
}

/** Pick several people: each click adds or removes one; "Unassigned" clears them all. */
export function AssigneesPick({
	value,
	people,
	onChange,
	children,
}: {
	value: string[];
	people: Person[];
	onChange: (memberIds: string[]) => void;
	children: ReactNode;
}) {
	return (
		<MultiPick
			search="Assign to…"
			onToggle={(id) =>
				onChange(
					!id
						? []
						: value.includes(id)
							? value.filter((v) => v !== id)
							: [...value, id],
				)
			}
			items={[
				{
					id: "",
					name: "Unassigned",
					icon: (
						<span
							className="av sm"
							style={{ "--c": "var(--q-gray)" } as React.CSSProperties}
						/>
					),
					on: !value.length,
				},
				...people.map((m) => ({
					id: m.id,
					name: m.isMe ? `${m.name} (you)` : m.name,
					icon: <Av name={m.name} image={m.image} className="sm" />,
					on: value.includes(m.id),
				})),
			]}
		>
			{children}
		</MultiPick>
	);
}

export function ProjectPick({
	value,
	projects,
	onPick,
	children,
}: {
	value: string;
	projects: { id: string; title: string; color: string | null }[];
	onPick: (projectId: string) => void;
	children: ReactNode;
}) {
	return (
		<SinglePick
			trigger={children}
			search="Move to project…"
			width={240}
			onPick={onPick}
			items={projects.map((p) => ({
				id: p.id,
				name: p.title,
				icon: (
					<span
						className="pdot"
						style={{ "--c": projectColor(p.color) } as React.CSSProperties}
					/>
				),
				on: value === p.id,
			}))}
		/>
	);
}

/** Toggles several options and stays open (labels, dependencies). */
export function MultiPick({
	items,
	onToggle,
	children,
	search,
	width = 240,
}: {
	items: PickItem[];
	onToggle: (id: string) => void;
	children: ReactNode;
	search?: string;
	width?: number;
}) {
	return (
		<PickPopover trigger={children} width={width}>
			<PickList items={items} search={search} onPick={onToggle} />
		</PickPopover>
	);
}

/** Quick picks plus a month grid (reference date popover + miniCal). */
export function DatePick({
	value,
	onPick,
	children,
	weekStartsOn = 1,
}: {
	value: string | null;
	onPick: (day: string | null) => void;
	children: ReactNode;
	/** 0 Sunday, 1 Monday (the "Start week on" preference) */
	weekStartsOn?: 0 | 1;
}) {
	const [open, setOpen] = useState(false);
	const [month, setMonth] = useState(() =>
		startOfMonth(value ? parseISO(value) : new Date()),
	);
	const today = new Date();
	const pick = (day: string | null) => {
		setOpen(false);
		onPick(day);
	};
	const fmt = (d: Date) => format(d, "yyyy-MM-dd");
	const quick: [string, Date][] = [
		["Today", today],
		["Tomorrow", addDays(today, 1)],
		["Next week", addDays(startOfWeek(today, { weekStartsOn: 1 }), 7)],
		["In 2 weeks", addDays(today, 14)],
	];
	const first = startOfWeek(month, { weekStartsOn });
	const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i));
	const selected = value ? parseISO(value) : null;
	return (
		<PickPopover
			trigger={children}
			open={open}
			onOpenChange={(o) => {
				setOpen(o);
				if (o) setMonth(startOfMonth(value ? parseISO(value) : new Date()));
			}}
		>
			<div className="row" style={{ gap: 4, padding: 4, flexWrap: "wrap" }}>
				{quick.map(([name, d]) => (
					<button
						key={name}
						type="button"
						className="badge"
						style={{ cursor: "pointer" }}
						onClick={() => pick(fmt(d))}
					>
						{name}
					</button>
				))}
				{value && (
					<button
						type="button"
						className="badge"
						style={{ cursor: "pointer", color: "var(--q-red)" }}
						onClick={() => pick(null)}
					>
						Clear
					</button>
				)}
			</div>
			<div className="msep" />
			<div style={{ padding: "6px 6px 2px", width: 252 }}>
				<div className="row" style={{ marginBottom: 6 }}>
					<b style={{ fontWeight: 600, fontSize: 13, paddingLeft: 4 }}>
						{format(month, "MMMM yyyy")}
					</b>
					<span className="sp" />
					<button
						type="button"
						className="ibtn ibtn-xs"
						aria-label="Previous month"
						onClick={() => setMonth(addMonths(month, -1))}
					>
						<span
							className="icon-[solar--alt-arrow-left-linear] size-3.5"
							aria-hidden="true"
						/>
					</button>
					<button
						type="button"
						className="ibtn ibtn-xs"
						aria-label="Next month"
						onClick={() => setMonth(addMonths(month, 1))}
					>
						<span
							className="icon-[solar--alt-arrow-right-linear] size-3.5"
							aria-hidden="true"
						/>
					</button>
				</div>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(7,1fr)",
						gap: 2,
						textAlign: "center",
						fontSize: 11,
					}}
				>
					{cells.slice(0, 7).map((d) => (
						<span
							key={d.toISOString()}
							className="faint"
							style={{ padding: "3px 0" }}
						>
							{format(d, "EEEEEE")}
						</span>
					))}
					{cells.map((d) => {
						const on = !!selected && isSameDay(d, selected);
						const isToday = isSameDay(d, today);
						return (
							<button
								key={d.toISOString()}
								type="button"
								className={cn(
									"calday",
									on && "on",
									isToday && "today",
									!isSameMonth(d, month) && "out",
								)}
								onClick={() => pick(fmt(d))}
								aria-label={format(d, "EEEE, MMMM d")}
								aria-pressed={on}
							>
								{format(d, "d")}
							</button>
						);
					})}
				</div>
			</div>
		</PickPopover>
	);
}
