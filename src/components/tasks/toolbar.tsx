import { type ReactNode, useEffect, useState } from "react";
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
import { LABELS, PRIORITIES, TASK_STATUSES } from "#/lib/tasks";
import {
	AGE_BUCKETS,
	DEFAULT_VIEW,
	DUE_BUCKETS,
	type Filter,
	type FilterField,
	type GroupBy,
	type SortField,
	type ViewState,
} from "#/lib/view-engine";
import { PrIcon } from "./bits";
import { useTaskView } from "./context";
import { PickPopover } from "./pick";

// The task view toolbar (reference viewToolbar + filterChips + filterBuilder).

/** Per-view filters, sort and grouping, remembered in this browser (reference S.views). */
export function useViewState(key: string, initial?: Partial<ViewState>) {
	const storageKey = `zadaci:view:${key}`;
	const [view, setView] = useState<ViewState>({ ...DEFAULT_VIEW, ...initial });
	// read after mount so the server and first client render agree
	// biome-ignore lint/correctness/useExhaustiveDependencies: reload only when the view key changes
	useEffect(() => {
		try {
			const saved = localStorage.getItem(storageKey);
			setView({
				...DEFAULT_VIEW,
				...initial,
				...(saved ? JSON.parse(saved) : {}),
			});
		} catch {
			setView({ ...DEFAULT_VIEW, ...initial });
		}
	}, [storageKey]);
	const update = (patch: Partial<ViewState>) =>
		setView((v) => {
			const next = { ...v, ...patch };
			try {
				localStorage.setItem(storageKey, JSON.stringify(next));
			} catch {}
			return next;
		});
	return [view, update] as const;
}

const SORTS: [SortField, string][] = [
	["manual", "Manual"],
	["priority", "Priority"],
	["due", "Due date"],
	["start", "Start date"],
	["title", "Title"],
	["status", "Status"],
	["assignee", "Assignee"],
	["created", "Created"],
	["updated", "Last updated"],
];
const SORT_NAME = Object.fromEntries([
	...SORTS,
	["estimate", "Estimate"],
	["project", "Project"],
]) as Record<SortField, string>;
const GROUPS: [GroupBy, string, string][] = [
	["status", "Status", "icon-[solar--record-circle-linear]"],
	["priority", "Priority", "icon-[solar--chart-2-linear]"],
	["assignee", "Assignee", "icon-[solar--user-linear]"],
	["project", "Project", "icon-[solar--folder-linear]"],
	["due", "Due date", "icon-[solar--calendar-linear]"],
	["none", "No grouping", "icon-[hugeicons--minus-sign]"],
];

const FIELD_META: Record<FilterField, { name: string; icon: string }> = {
	status: { name: "Status", icon: "icon-[solar--record-circle-linear]" },
	assignee: { name: "Assignee", icon: "icon-[solar--user-linear]" },
	priority: { name: "Priority", icon: "icon-[solar--chart-2-linear]" },
	due: { name: "Due date", icon: "icon-[solar--calendar-linear]" },
	project: { name: "Project", icon: "icon-[solar--folder-linear]" },
	labels: { name: "Labels", icon: "icon-[solar--tag-linear]" },
	created: { name: "Created date", icon: "icon-[solar--calendar-add-linear]" },
	updated: { name: "Updated date", icon: "icon-[solar--history-linear]" },
};

type Option = { id: string; name: string; icon?: ReactNode };

/** Options for a filter field (reference FIELDS[f].opts). */
function useFieldOptions(): (f: FilterField) => Option[] {
	const { members, projects } = useTaskView();
	return (f) => {
		if (f === "status")
			return TASK_STATUSES.map((s) => ({
				id: s.id,
				name: s.name,
				icon: <StatusIcon status={s.id} />,
			}));
		if (f === "priority")
			return PRIORITIES.map((p) => ({
				id: p.id,
				name: p.name,
				icon: <PrIcon p={p.id} />,
			}));
		if (f === "assignee")
			return [
				{
					id: "none",
					name: "Unassigned",
					icon: (
						<span
							className="av sm"
							style={{ "--c": "var(--q-gray)" } as React.CSSProperties}
						/>
					),
				},
				...members.map((m) => ({
					id: m.id,
					name: m.isMe ? `${m.name} (you)` : m.name,
					icon: <Av name={m.name} image={m.image} className="sm" />,
				})),
			];
		if (f === "project")
			return projects.map((p) => ({
				id: p.id,
				name: p.title,
				icon: (
					<span
						className="pdot"
						style={{ "--c": projectColor(p.color) } as React.CSSProperties}
					/>
				),
			}));
		if (f === "labels")
			return LABELS.map((l) => ({
				id: l.id,
				name: l.name,
				icon: (
					<span
						className="pdot"
						style={{ "--c": l.c } as React.CSSProperties}
					/>
				),
			}));
		if (f === "due")
			return DUE_BUCKETS.map((b) => ({ id: b.id, name: b.name }));
		return AGE_BUCKETS.map((b) => ({ id: b.id, name: b.name }));
	};
}

export function ViewToolbar({
	view,
	setView,
	fields,
	group = true,
	right,
	extra,
}: {
	view: ViewState;
	setView: (patch: Partial<ViewState>) => void;
	/** filter fields this view offers (project views drop "project") */
	fields: FilterField[];
	group?: boolean;
	right?: ReactNode;
	extra?: ReactNode;
}) {
	return (
		<>
			<div className="toolbar" role="toolbar">
				<div className="inwrap">
					<span
						className="i icon-[solar--magnifer-linear] size-[13px]"
						aria-hidden="true"
					/>
					<input
						className="input search-sm"
						placeholder="Search tasks"
						aria-label="Search tasks"
						value={view.q}
						onChange={(e) => setView({ q: e.target.value })}
					/>
				</div>
				<PickPopover
					width={560}
					trigger={
						<button
							type="button"
							className={
								view.filters.length ? "btn btn-ghost on" : "btn btn-ghost"
							}
						>
							<span
								className="icon-[hugeicons--filter] size-3.5"
								aria-hidden="true"
							/>
							Filter
							{!!view.filters.length && (
								<span
									className="badge accent"
									style={{ height: 16, padding: "0 5px" }}
								>
									{view.filters.length}
								</span>
							)}
						</button>
					}
				>
					<FilterBuilder view={view} setView={setView} fields={fields} />
				</PickPopover>
				<Menu>
					<MenuTrigger className="btn btn-ghost">
						<span
							className="icon-[solar--sort-vertical-linear] size-3.5"
							aria-hidden="true"
						/>
						<span className="hide-m">Sort:</span> {SORT_NAME[view.sort.f]}
					</MenuTrigger>
					<MenuContent width={240} align="start">
						<MenuLabel>Sort by</MenuLabel>
						{SORTS.map(([k, n]) => (
							<MenuItem
								key={k}
								checked={view.sort.f === k}
								onSelect={() => setView({ sort: { ...view.sort, f: k } })}
							>
								{n}
							</MenuItem>
						))}
						<MenuSeparator />
						<div style={{ padding: "4px 6px" }}>
							<div className="seg" style={{ width: "100%" }}>
								{(
									[
										[1, "Ascending", "icon-[solar--arrow-up-linear]"],
										[-1, "Descending", "icon-[solar--arrow-down-linear]"],
									] as const
								).map(([dir, n, icon]) => (
									<button
										key={dir}
										type="button"
										className={view.sort.dir === dir ? "on" : ""}
										style={{ flex: 1, justifyContent: "center" }}
										onClick={() => setView({ sort: { ...view.sort, dir } })}
									>
										<span className={`${icon} size-3`} aria-hidden="true" />
										{n}
									</button>
								))}
							</div>
						</div>
					</MenuContent>
				</Menu>
				{group && (
					<Menu>
						<MenuTrigger className="btn btn-ghost">
							<span
								className="icon-[solar--layers-minimalistic-linear] size-3.5"
								aria-hidden="true"
							/>
							<span className="hide-m">Group:</span>{" "}
							{GROUPS.find(([k]) => k === view.group)?.[1].replace(
								"No grouping",
								"None",
							)}
						</MenuTrigger>
						<MenuContent width={220} align="start">
							<MenuLabel>Group by</MenuLabel>
							{GROUPS.map(([k, n, icon]) => (
								<MenuItem
									key={k}
									icon={icon}
									checked={view.group === k}
									onSelect={() => setView({ group: k })}
								>
									{n}
								</MenuItem>
							))}
						</MenuContent>
					</Menu>
				)}
				{extra}
				<span className="sp" />
				{right}
			</div>
			<FilterChips view={view} setView={setView} fields={fields} />
		</>
	);
}

const describe = (opts: Option[], f: Filter) => {
	const names = f.v.map((id) => opts.find((o) => o.id === id)?.name ?? id);
	return names.length
		? names.length > 2
			? `${names.length} selected`
			: names.join(", ")
		: "any";
};

function FilterChips({
	view,
	setView,
	fields,
}: {
	view: ViewState;
	setView: (patch: Partial<ViewState>) => void;
	fields: FilterField[];
}) {
	const optionsOf = useFieldOptions();
	if (!view.filters.length) return null;
	const remove = (i: number) =>
		setView({ filters: view.filters.filter((_, j) => j !== i) });
	return (
		<div className="chipsbar">
			<span
				className="icon-[hugeicons--filter] size-[13px]"
				aria-hidden="true"
			/>
			{view.filters.map((f, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: filters are positional rows
				<span key={i} className="row" style={{ gap: 6 }}>
					{i > 0 && <span>and</span>}
					<span className="chip">
						<PickPopover
							width={240}
							trigger={
								<button
									type="button"
									style={{
										display: "inline-flex",
										gap: 5,
										alignItems: "center",
									}}
								>
									<span
										className={`${FIELD_META[f.f].icon} size-3`}
										aria-hidden="true"
									/>
									<b>{FIELD_META[f.f].name}</b>{" "}
									{f.op === "not" ? "is not" : "is"}{" "}
									<span>{describe(optionsOf(f.f), f)}</span>
								</button>
							}
						>
							<div className="mh">
								{FIELD_META[f.f].name} {f.op === "not" ? "is not" : "is"}
							</div>
							<ValueChecks
								options={optionsOf(f.f)}
								values={f.v}
								onToggle={(id) =>
									setView({
										filters: view.filters.map((x, j) =>
											j === i
												? {
														...x,
														v: x.v.includes(id)
															? x.v.filter((v) => v !== id)
															: [...x.v, id],
													}
												: x,
										),
									})
								}
							/>
						</PickPopover>
						<button
							type="button"
							className="ibtn"
							aria-label="Remove filter"
							onClick={() => remove(i)}
						>
							<span
								className="icon-[solar--close-circle-linear] size-3"
								aria-hidden="true"
							/>
						</button>
					</span>
				</span>
			))}
			<PickPopover
				width={560}
				trigger={
					<button type="button" className="btn btn-sm btn-ghost">
						<span
							className="icon-[hugeicons--plus-sign] size-3"
							aria-hidden="true"
						/>
						Add
					</button>
				}
			>
				<FilterBuilder view={view} setView={setView} fields={fields} />
			</PickPopover>
			<span className="sp" />
			<button
				type="button"
				className="btn btn-sm btn-ghost"
				onClick={() => setView({ filters: [] })}
			>
				Clear all
			</button>
		</div>
	);
}

function ValueChecks({
	options,
	values,
	onToggle,
}: {
	options: Option[];
	values: string[];
	onToggle: (id: string) => void;
}) {
	return (
		<>
			{options.map((o) => (
				<label
					key={o.id}
					className="mi"
					style={{ cursor: "pointer", minHeight: 28 }}
				>
					<input
						type="checkbox"
						className="check"
						checked={values.includes(o.id)}
						onChange={() => onToggle(o.id)}
					/>
					{o.icon}
					{o.name}
				</label>
			))}
		</>
	);
}

/** "Where Status is …, and Assignee is …" rows (reference filterBuilder). */
function FilterBuilder({
	view,
	setView,
	fields,
}: {
	view: ViewState;
	setView: (patch: Partial<ViewState>) => void;
	fields: FilterField[];
}) {
	const optionsOf = useFieldOptions();
	const [editing, setEditing] = useState<number | null>(null);
	const setRow = (i: number, patch: Partial<Filter>) =>
		setView({
			filters: view.filters.map((f, j) => (j === i ? { ...f, ...patch } : f)),
		});
	return (
		<>
			<div className="mh fb-h">
				Filter by
				{!!view.filters.length && (
					<button
						type="button"
						className="btn btn-sm btn-ghost"
						onClick={() => setView({ filters: [] })}
					>
						Clear all
					</button>
				)}
			</div>
			{view.filters.length ? (
				<div className="fb-rows">
					{view.filters.map((f, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: filters are positional rows
						<div key={i}>
							<div className="frow">
								<span className="conj">{i ? "and" : "Where"}</span>
								<select
									className="select"
									aria-label="Field"
									value={f.f}
									onChange={(e) =>
										setRow(i, { f: e.target.value as FilterField, v: [] })
									}
								>
									{fields.map((k) => (
										<option key={k} value={k}>
											{FIELD_META[k].name}
										</option>
									))}
								</select>
								<select
									className="select"
									aria-label="Operator"
									value={f.op}
									onChange={(e) =>
										setRow(i, { op: e.target.value as Filter["op"] })
									}
								>
									<option value="is">is</option>
									<option value="not">is not</option>
								</select>
								<button
									type="button"
									className="valbtn"
									aria-expanded={editing === i}
									onClick={() => setEditing(editing === i ? null : i)}
								>
									<span className="trunc grow">
										{f.v.length ? (
											describe(optionsOf(f.f), f)
										) : (
											<span className="faint">Select…</span>
										)}
									</span>
									<span
										className="icon-[solar--alt-arrow-down-linear] size-3"
										aria-hidden="true"
									/>
								</button>
								<button
									type="button"
									className="ibtn ibtn-xs"
									aria-label="Remove filter"
									onClick={() =>
										setView({ filters: view.filters.filter((_, j) => j !== i) })
									}
								>
									<span
										className="icon-[solar--trash-bin-minimalistic-linear] size-[13px]"
										aria-hidden="true"
									/>
								</button>
							</div>
							{editing === i && (
								<div
									style={{
										marginLeft: 50,
										border: "1px solid var(--q-border)",
										borderRadius: "var(--q-r)",
										padding: 4,
										maxHeight: 200,
										overflow: "auto",
									}}
								>
									<ValueChecks
										options={optionsOf(f.f)}
										values={f.v}
										onToggle={(id) =>
											setRow(i, {
												v: f.v.includes(id)
													? f.v.filter((v) => v !== id)
													: [...f.v, id],
											})
										}
									/>
								</div>
							)}
						</div>
					))}
				</div>
			) : (
				<p className="fb-empty">
					No filters applied. Combine filters to narrow the task list, e.g.
					Status is In Progress and Assignee is Sarah.
				</p>
			)}
			<div className="msep" />
			<div className="fb-add">
				<span className="faint">Add filter:</span>
				{fields.map((k) => (
					<button
						key={k}
						type="button"
						className="badge"
						style={{ cursor: "pointer" }}
						onClick={() => {
							setView({
								filters: [...view.filters, { f: k, op: "is", v: [] }],
							});
							setEditing(view.filters.length);
						}}
					>
						<span
							className={`${FIELD_META[k].icon} size-[11px]`}
							aria-hidden="true"
						/>
						{FIELD_META[k].name}
					</button>
				))}
			</div>
		</>
	);
}

export const ALL_FIELDS: FilterField[] = [
	"status",
	"assignee",
	"priority",
	"due",
	"project",
	"labels",
	"created",
	"updated",
];
export const PROJECT_FIELDS: FilterField[] = ALL_FIELDS.filter(
	(f) => f !== "project",
);
