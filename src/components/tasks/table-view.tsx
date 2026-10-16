import { format, parseISO } from "date-fns";
import { type ReactNode, useState } from "react";
import { projectColor } from "#/components/projects/bits";
import { Av } from "#/components/q/av";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuLabel,
	MenuSeparator,
	MenuTrigger,
} from "#/components/q/menu";
import { StatusIcon } from "#/components/q/status-icon";
import type { TaskItem } from "#/graphql/operations";
import { ESTIMATES, LABELS } from "#/lib/tasks";
import { fmtDay } from "#/lib/time";
import { cn } from "#/lib/utils";
import {
	type Group,
	isOverdue,
	type SortField,
	type ViewState,
} from "#/lib/view-engine";
import { Due, Lbl, PrPill, StPill } from "./bits";
import { useTaskView } from "./context";
import {
	AssigneePick,
	DatePick,
	MultiPick,
	PickList,
	PickPopover,
	PriorityPick,
	ProjectPick,
	StatusPick,
} from "./pick";

// The Table view (reference views/table.js): a spreadsheet of tasks with resizable,
// hideable columns and cells you click to change.

type ColKey =
	| "title"
	| "status"
	| "priority"
	| "assignee"
	| "due"
	| "start"
	| "labels"
	| "deps"
	| "estimate"
	| "created"
	| "project";
export const TABLE_COLS: [ColKey, string, number][] = [
	["title", "Task", 314],
	["status", "Status", 132],
	["priority", "Priority", 112],
	["assignee", "Assignee", 156],
	["due", "Due date", 112],
	["start", "Start date", 112],
	["labels", "Labels", 180],
	["deps", "Dependencies", 150],
	["estimate", "Estimate", 92],
	["created", "Created", 112],
	["project", "Project", 156],
];
const SORTABLE: Partial<Record<ColKey, SortField>> = {
	title: "title",
	status: "status",
	priority: "priority",
	assignee: "assignee",
	due: "due",
	start: "start",
	estimate: "estimate",
	created: "created",
	project: "project",
};

/** The "Columns" toolbar menu: show or hide columns, reset widths. */
export function ColumnsMenu({
	view,
	setView,
	hideProject,
}: {
	view: ViewState;
	setView: (patch: Partial<ViewState>) => void;
	hideProject?: boolean;
}) {
	return (
		<Menu>
			<MenuTrigger className="btn btn-ghost">
				<span
					className="icon-[solar--widget-linear] size-3.5"
					aria-hidden="true"
				/>
				Columns
			</MenuTrigger>
			<MenuContent width={220} align="start">
				<MenuLabel>Visible columns</MenuLabel>
				{TABLE_COLS.filter(
					([k]) => k !== "title" && !(hideProject && k === "project"),
				).map(([k, name]) => (
					<MenuItem
						key={k}
						checked={!view.hidden.includes(k)}
						onSelect={() =>
							setView({
								hidden: view.hidden.includes(k)
									? view.hidden.filter((h) => h !== k)
									: [...view.hidden, k],
							})
						}
					>
						{name}
					</MenuItem>
				))}
				<MenuSeparator />
				<MenuItem
					icon="icon-[solar--restart-linear]"
					onSelect={() => setView({ colW: {} })}
				>
					Reset widths
				</MenuItem>
			</MenuContent>
		</Menu>
	);
}

export function TableView({
	groups,
	view,
	setView,
	projectId,
	onNew,
}: {
	groups: Group<TaskItem>[];
	view: ViewState;
	setView: (patch: Partial<ViewState>) => void;
	/** a project's table hides the Project column */
	projectId?: string;
	onNew?: () => void;
}) {
	const cols = TABLE_COLS.filter(
		([k]) =>
			k === "title" ||
			(!view.hidden.includes(k) && !(projectId && k === "project")),
	);
	const width = (c: (typeof TABLE_COLS)[number]) => view.colW[c[0]] ?? c[2];
	const total = cols.reduce((sum, c) => sum + width(c), 0);
	const all = groups.flatMap((g) => g.tasks);
	const byId = new Map(all.map((t) => [t.id, t]));
	return (
		<>
			<div className="tbl-wrap hide-m">
				<table
					className="tbl"
					style={{ width: total }}
					aria-label="Tasks table"
				>
					<colgroup>
						{cols.map((c) => (
							<col key={c[0]} data-col={c[0]} style={{ width: width(c) }} />
						))}
					</colgroup>
					<thead>
						<tr>
							{cols.map((c) => {
								const field = SORTABLE[c[0]];
								const on = !!field && view.sort.f === field;
								return (
									<th
										key={c[0]}
										className={c[0] === "title" ? "sticky" : undefined}
										style={{ position: "sticky" }}
										scope="col"
									>
										<button
											type="button"
											className="thi"
											onClick={() =>
												field &&
												setView({
													sort: {
														f: field,
														dir: on ? (view.sort.dir === 1 ? -1 : 1) : 1,
													},
												})
											}
										>
											{c[1]}
											{on && (
												<span
													className={cn(
														view.sort.dir > 0
															? "icon-[solar--arrow-up-linear]"
															: "icon-[solar--arrow-down-linear]",
														"size-[11px]",
													)}
													aria-hidden="true"
												/>
											)}
										</button>
										<Resizer
											onResize={(w) =>
												setView({ colW: { ...view.colW, [c[0]]: w } })
											}
											start={width(c)}
										/>
									</th>
								);
							})}
						</tr>
					</thead>
					<tbody>
						{groups.map((g) => (
							<GroupRows
								key={g.key}
								g={g}
								cols={cols.map((c) => c[0])}
								showHead={view.group !== "none"}
								byId={byId}
							/>
						))}
						{onNew && (
							<tr>
								<td
									className="sticky cellbtn"
									colSpan={cols.length}
									style={{ color: "var(--q-text-3)" }}
								>
									<button
										type="button"
										className="row"
										style={{ gap: 6 }}
										onClick={onNew}
									>
										<span
											className="icon-[hugeicons--plus-sign] size-3.5"
											aria-hidden="true"
										/>
										New task
									</button>
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
			<MobileCards tasks={all} />
		</>
	);
}

/** Drag the edge of a header to resize its column (reference data-rsz). */
function Resizer({
	start,
	onResize,
}: {
	start: number;
	onResize: (w: number) => void;
}) {
	const [active, setActive] = useState(false);
	return (
		<span
			className={cn("rsz", active && "on")}
			aria-hidden="true"
			onPointerDown={(e) => {
				e.preventDefault();
				e.stopPropagation();
				const th = e.currentTarget.closest("th");
				const table = e.currentTarget.closest("table");
				const col = table?.querySelector<HTMLTableColElement>(
					`col:nth-child(${(th?.cellIndex ?? 0) + 1})`,
				);
				const x0 = e.clientX;
				const tw0 = table?.getBoundingClientRect().width ?? 0;
				setActive(true);
				const move = (ev: PointerEvent) => {
					const w = Math.max(64, start + ev.clientX - x0);
					if (col) col.style.width = `${w}px`;
					if (table) table.style.width = `${tw0 + w - start}px`;
				};
				const up = (ev: PointerEvent) => {
					removeEventListener("pointermove", move);
					removeEventListener("pointerup", up);
					setActive(false);
					onResize(Math.max(64, Math.round(start + ev.clientX - x0)));
				};
				addEventListener("pointermove", move);
				addEventListener("pointerup", up);
			}}
		/>
	);
}

function GroupRows({
	g,
	cols,
	showHead,
	byId,
}: {
	g: Group<TaskItem>;
	cols: ColKey[];
	showHead: boolean;
	byId: Map<string, TaskItem>;
}) {
	return (
		<>
			{showHead && (
				<tr className="grow-row">
					<td className="sticky" colSpan={cols.length}>
						<span className="row" style={{ gap: 6 }}>
							{g.set.status && <StatusIcon status={g.set.status} />}
							{g.name}
							<span className="faint" style={{ fontWeight: 500 }}>
								{g.tasks.length}
							</span>
						</span>
					</td>
				</tr>
			)}
			{g.tasks.map((t) => (
				<tr key={t.id}>
					{cols.map((c) => (
						<Cell key={c} t={t} col={c} byId={byId} />
					))}
				</tr>
			))}
		</>
	);
}

/** A clickable cell: the whole cell opens its picker, like the reference td.cellbtn. */
function PickCell({
	editable,
	className,
	style,
	children,
	picker,
}: {
	editable: boolean;
	className?: string;
	style?: React.CSSProperties;
	children: ReactNode;
	picker: (trigger: ReactNode) => ReactNode;
}) {
	if (!editable)
		return (
			<td className={className} style={style}>
				{children}
			</td>
		);
	return (
		<td className={cn("cellbtn", className)} style={style}>
			{picker(
				<button
					type="button"
					className="row"
					style={{ gap: 6, width: "100%", minHeight: 22, textAlign: "left" }}
				>
					{children}
				</button>,
			)}
		</td>
	);
}

const dash = <span className="faint">—</span>;

function Cell({
	t,
	col,
	byId,
}: {
	t: TaskItem;
	col: ColKey;
	byId: Map<string, TaskItem>;
}) {
	const { update, canEdit, openTask, member, project, members, projects } =
		useTaskView();
	const editable = canEdit(t.projectId);
	const [renaming, setRenaming] = useState(false);
	const [title, setTitle] = useState(t.name);
	switch (col) {
		case "title":
			return renaming ? (
				<td className="sticky editing">
					<input
						value={title}
						aria-label="Title"
						onChange={(e) => setTitle(e.target.value)}
						onBlur={() => {
							setRenaming(false);
							if (title.trim() && title.trim() !== t.name)
								update(t, { title: title.trim() });
						}}
						onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
						// biome-ignore lint/a11y/noAutofocus: double-click opens the title for typing
						autoFocus
					/>
				</td>
			) : (
				<td
					className="sticky cellbtn"
					title={editable ? "Double-click to rename" : undefined}
				>
					<button
						type="button"
						className="row"
						style={{ gap: 8, width: "100%", textAlign: "left" }}
						onClick={() => openTask(t.id)}
						onDoubleClick={() => {
							if (!editable) return;
							setTitle(t.name);
							setRenaming(true);
						}}
					>
						<StatusIcon status={t.status} size={13} />
						<span className="trunc" style={{ fontWeight: 450 }}>
							{t.name}
						</span>
						<span
							className="mono faint"
							style={{ fontSize: 11, marginLeft: "auto" }}
						>
							{t.key}
						</span>
					</button>
				</td>
			);
		case "status":
			return (
				<PickCell
					editable={editable}
					picker={(tr) => (
						<StatusPick
							value={t.status}
							onPick={(s) => update(t, { status: s })}
						>
							{tr}
						</StatusPick>
					)}
				>
					<StPill status={t.status} />
				</PickCell>
			);
		case "priority":
			return (
				<PickCell
					editable={editable}
					picker={(tr) => (
						<PriorityPick
							value={t.priority}
							onPick={(p) => update(t, { priority: p })}
						>
							{tr}
						</PriorityPick>
					)}
				>
					<PrPill p={t.priority} />
				</PickCell>
			);
		case "assignee": {
			const m = member(t.assigneeId);
			return (
				<PickCell
					editable={editable}
					picker={(tr) => (
						<AssigneePick
							value={t.assigneeId}
							people={members}
							onPick={(id) => update(t, { assigneeId: id })}
						>
							{tr}
						</AssigneePick>
					)}
				>
					{m ? (
						<Av name={m.name} image={m.image} className="sm" />
					) : (
						<span
							className="av sm"
							style={{ "--c": "var(--q-gray)" } as React.CSSProperties}
						/>
					)}
					<span className={cn("trunc", !m && "faint")}>
						{m?.name ?? "Unassigned"}
					</span>
				</PickCell>
			);
		}
		case "due":
		case "start": {
			const field = col === "due" ? "dueDate" : "startDate";
			const day = t[field];
			return (
				<PickCell
					editable={editable}
					className="num"
					style={
						col === "due" && isOverdue(t)
							? { color: "var(--q-red)" }
							: undefined
					}
					picker={(tr) => (
						<DatePick value={day} onPick={(d) => update(t, { [field]: d })}>
							{tr}
						</DatePick>
					)}
				>
					{day ? fmtDay(day) : dash}
				</PickCell>
			);
		}
		case "labels":
			return (
				<PickCell
					editable={editable}
					picker={(tr) => (
						<MultiPick
							search="Filter labels…"
							onToggle={(id) =>
								update(t, {
									labels: t.labels.includes(id)
										? t.labels.filter((l) => l !== id)
										: [...t.labels, id],
								})
							}
							items={LABELS.map((l) => ({
								id: l.id,
								name: l.name,
								icon: (
									<span
										className="pdot"
										style={{ "--c": l.c } as React.CSSProperties}
									/>
								),
								on: t.labels.includes(l.id),
							}))}
						>
							{tr}
						</MultiPick>
					)}
				>
					{t.labels.length
						? t.labels.map((id) => <Lbl key={id} id={id} />)
						: dash}
				</PickCell>
			);
		case "deps":
			return (
				<td>
					{t.dependsOn.length
						? t.dependsOn.map((id) => {
								const d = byId.get(id);
								return d ? (
									<span key={id} className="depchip" title={d.name}>
										{d.key}
									</span>
								) : null;
							})
						: dash}
				</td>
			);
		case "estimate":
			return (
				<PickCell
					editable={editable}
					className="num"
					picker={(tr) => (
						<PickPopover width={180} trigger={tr}>
							<PickList
								items={[
									...ESTIMATES.map((e) => ({
										id: e,
										name: e,
										on: t.estimate === e,
									})),
									{ id: "", name: "Clear estimate" },
								]}
								onPick={(id) => update(t, { estimate: id || null })}
							/>
						</PickPopover>
					)}
				>
					{t.estimate ?? dash}
				</PickCell>
			);
		case "created":
			return (
				<td className="num muted">{format(parseISO(t.createdAt), "MMM d")}</td>
			);
		case "project": {
			const p = project(t.projectId);
			return (
				<PickCell
					editable={editable && !t.parentId}
					picker={(tr) => (
						<ProjectPick
							value={t.projectId}
							projects={projects.filter(
								(x) => x.status !== "complete" && canEdit(x.id),
							)}
							onPick={(id) =>
								id !== t.projectId && update(t, { projectId: id })
							}
						>
							{tr}
						</ProjectPick>
					)}
				>
					<span
						className="pdot"
						style={{ "--c": projectColor(p?.color) } as React.CSSProperties}
					/>
					<span className="trunc">{p?.title}</span>
				</PickCell>
			);
		}
	}
}

/** Phones get stacked cards instead of a wide table (reference .only-m). */
function MobileCards({ tasks }: { tasks: TaskItem[] }) {
	const { openTask, member } = useTaskView();
	return (
		<div className="only-m" style={{ padding: "8px 16px 90px" }}>
			{tasks.map((t) => {
				const m = member(t.assigneeId);
				return (
					<button
						key={t.id}
						type="button"
						className="panel"
						style={{
							padding: 12,
							marginBottom: 8,
							width: "100%",
							textAlign: "left",
						}}
						onClick={() => openTask(t.id)}
					>
						<div className="row" style={{ marginBottom: 8 }}>
							<StatusIcon status={t.status} />
							<b style={{ fontWeight: 500 }} className="grow">
								{t.name}
							</b>
							<span className="mono faint" style={{ fontSize: 11 }}>
								{t.key}
							</span>
						</div>
						<div
							className="row muted"
							style={{ flexWrap: "wrap", gap: 10, fontSize: 12 }}
						>
							<PrPill p={t.priority} />
							{m && <Av name={m.name} image={m.image} className="sm" />}
							<span className="muted">{m?.name ?? "Unassigned"}</span>
							<Due day={t.dueDate} status={t.status} />
						</div>
					</button>
				);
			})}
		</div>
	);
}
