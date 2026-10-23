import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type ReactNode, useState } from "react";
import { projectColor } from "#/components/projects/bits";
import { Av } from "#/components/q/av";
import { ConfirmModal } from "#/components/q/confirm";
import { StatusIcon } from "#/components/q/status-icon";
import {
	BULK_UPDATE_TASKS,
	DELETE_TASKS,
	TASK_FIELDS,
	type TaskItem,
} from "#/graphql/operations";
import { toast } from "#/lib/toast";
import { cn, count } from "#/lib/utils";
import {
	type Group,
	planDrop,
	type SortField,
	type ViewState,
} from "#/lib/view-engine";
import { PrIcon } from "./bits";
import {
	CellAssignee,
	CellDue,
	CellLabels,
	CellPrio,
	CellProject,
	CellStatus,
} from "./cells";
import { TASK_REFETCH, useTaskView, useUndoDelete } from "./context";
import { AssigneePick, PriorityPick, StatusPick } from "./pick";
import { TaskMenu } from "./task-menu";

// The List view (reference task-list.js listHtml / taskRow / bulkBar), with drag and drop
// from dnd-kit: drag a row by its handle to reorder, or into another group to change
// its status, priority, assignee or project.

export type Col =
	| "status"
	| "assignee"
	| "priority"
	| "due"
	| "labels"
	| "project";
const COLS: Record<Col, [string, string, SortField]> = {
	status: ["Status", "126px", "status"],
	assignee: ["Assignee", "150px", "assignee"],
	priority: ["Priority", "108px", "priority"],
	due: ["Due date", "104px", "due"],
	labels: ["Labels", "168px", "manual"],
	project: ["Project", "160px", "project"],
};
const CELL: Record<Col, (p: { t: TaskItem }) => ReactNode> = {
	status: CellStatus,
	assignee: CellAssignee,
	priority: CellPrio,
	due: CellDue,
	labels: CellLabels,
	project: CellProject,
};

const SUBTASKS = gql`
	${TASK_FIELDS}
	query TaskSubtasks($slug: String!, $id: ID!) {
		workspace(slug: $slug) {
			id
			task(id: $id) {
				id
				subtasks {
					...TaskFields
				}
			}
		}
	}
`;

export function ListView({
	groups,
	view,
	setView,
	cols = ["status", "assignee", "priority", "due", "labels"],
	projectId,
	complete,
	empty,
	groupIcon,
	drag = true,
}: {
	groups: Group<TaskItem>[];
	view: ViewState;
	setView: (patch: Partial<ViewState>) => void;
	cols?: Col[];
	/** where new tasks go when the group doesn't say */
	projectId?: string;
	/** round "complete" checkboxes instead of selection (My Tasks) */
	complete?: boolean;
	empty?: ReactNode;
	/** custom group icons (My Tasks); default comes from what the group sets */
	groupIcon?: (key: string) => ReactNode;
	/** drag and drop to reorder; off where order means nothing (My Tasks) */
	drag?: boolean;
}) {
	const { slug, update, canEdit, projects } = useTaskView();
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [collapsed, setCollapsed] = useState<Set<string>>(
		() => new Set(groups.filter((g) => g.collapsed).map((g) => g.key)),
	);
	const [dragging, setDragging] = useState<TaskItem | null>(null);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);
	const tpl = `18px 30px minmax(220px,1fr) ${cols.map((c) => COLS[c][1]).join(" ")} 40px`;
	const listed = groups.flatMap((g) => g.tasks);
	// only tasks the viewer can edit can be picked for bulk changes
	const all = listed.filter((t) => canEdit(t.projectId));
	const nSel = all.filter((t) => selected.has(t.id)).length;
	if (!listed.length && empty) return <>{empty}</>;
	const showHeaders = groups.length > 1 || groups[0]?.key !== "all";
	const fallbackProject =
		projectId ??
		projects.find((p) => p.status !== "complete" && canEdit(p.id))?.id;

	function onDragEnd({ active, over }: DragEndEvent) {
		setDragging(null);
		const task = all.find((t) => t.id === active.id);
		if (!over || !task) return;
		const fromGroup = String(active.data.current?.group ?? "");
		const toGroup = String(
			over.data.current?.group ?? String(over.id).replace(/^grp:/, ""),
		);
		const plan = planDrop(groups, task.id, fromGroup, toGroup, String(over.id));
		if (!plan) return;
		// order only means something when the list is in manual order
		const patch = {
			...(view.sort.f === "manual" && { sortOrder: plan.sortOrder }),
			...plan.set,
		};
		if (Object.keys(patch).length) update(task, patch);
	}

	return (
		<>
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragStart={({ active }: DragStartEvent) =>
					setDragging(all.find((t) => t.id === active.id) ?? null)
				}
				onDragEnd={onDragEnd}
				onDragCancel={() => setDragging(null)}
			>
				<div className="tlist">
					<div
						className="thead"
						style={{ "--cols": tpl } as React.CSSProperties}
					>
						<div />
						<div>
							{!complete && all.length > 0 && (
								<input
									type="checkbox"
									className="check"
									aria-label="Select all"
									checked={!!nSel && nSel === all.length}
									ref={(el) => {
										if (el) el.indeterminate = !!nSel && nSel < all.length;
									}}
									onChange={() =>
										setSelected(
											nSel === all.length
												? new Set()
												: new Set(all.map((t) => t.id)),
										)
									}
								/>
							)}
						</div>
						<SortHead
							label="Task"
							field="title"
							view={view}
							setView={setView}
						/>
						{cols.map((c) => (
							<SortHead
								key={c}
								label={COLS[c][0]}
								field={COLS[c][2]}
								view={view}
								setView={setView}
							/>
						))}
						<div />
					</div>
					{groups.map((g) => {
						const open = !collapsed.has(g.key);
						return (
							<SortableContext
								key={g.key}
								items={g.tasks.map((t) => t.id)}
								strategy={verticalListSortingStrategy}
							>
								{showHeaders && (
									<GroupHead
										g={g}
										icon={groupIcon?.(g.key)}
										open={open}
										onToggle={() => {
											const next = new Set(collapsed);
											next.has(g.key) ? next.delete(g.key) : next.add(g.key);
											setCollapsed(next);
										}}
									/>
								)}
								{open &&
									g.tasks.map((t) => (
										<Row
											key={t.id}
											t={t}
											group={g.key}
											cols={cols}
											tpl={tpl}
											complete={complete}
											drag={drag}
											selected={selected.has(t.id)}
											onSelect={() => {
												const next = new Set(selected);
												next.has(t.id) ? next.delete(t.id) : next.add(t.id);
												setSelected(next);
											}}
										/>
									))}
								{open && (g.set.projectId ?? fallbackProject) && (
									<Composer
										group={g}
										projectId={(g.set.projectId ?? fallbackProject) as string}
									/>
								)}
							</SortableContext>
						);
					})}
				</div>
				<DragOverlay>
					{dragging && (
						<div
							className="trow dragging"
							style={
								{
									"--cols": tpl,
									boxShadow: "var(--q-shadow-pop)",
								} as React.CSSProperties
							}
						>
							<div className="handle">
								<span
									className="icon-[hugeicons--drag-drop-vertical] size-3.5"
									aria-hidden="true"
								/>
							</div>
							<div />
							<div className="ttl">
								<span className="key">{dragging.key}</span>
								<span className="tt">{dragging.name}</span>
							</div>
						</div>
					)}
				</DragOverlay>
			</DndContext>
			{!complete && (
				<BulkBar
					ids={all.filter((t) => selected.has(t.id)).map((t) => t.id)}
					slug={slug}
					onClear={() => setSelected(new Set())}
				/>
			)}
		</>
	);
}

function SortHead({
	label,
	field,
	view,
	setView,
}: {
	label: string;
	field: SortField;
	view: ViewState;
	setView: (patch: Partial<ViewState>) => void;
}) {
	const on = view.sort.f === field && field !== "manual";
	return (
		<button
			type="button"
			style={{
				cursor: "pointer",
				textAlign: "left",
				display: "inline-flex",
				gap: 4,
				alignItems: "center",
			}}
			onClick={() =>
				setView({
					sort: { f: field, dir: on ? (view.sort.dir === 1 ? -1 : 1) : 1 },
				})
			}
		>
			{label}
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
	);
}

function GroupHead({
	g,
	open,
	onToggle,
	icon: custom,
}: {
	g: Group<TaskItem>;
	open: boolean;
	onToggle: () => void;
	icon?: ReactNode;
}) {
	const { member, project } = useTaskView();
	const { setNodeRef, isOver } = useDroppable({
		id: `grp:${g.key}`,
		data: { group: g.key },
	});
	let icon: ReactNode = custom ?? null;
	if (custom) {
		// the caller chose the icon
	} else if (g.set.status) icon = <StatusIcon status={g.set.status} />;
	else if (g.set.priority) icon = <PrIcon p={g.set.priority} />;
	else if ("assigneeId" in g.set) {
		const m = member(g.set.assigneeId ?? null);
		icon = m ? (
			<Av name={m.name} image={m.image} className="sm" />
		) : (
			<span
				className="av sm"
				style={{ "--c": "var(--q-gray)" } as React.CSSProperties}
			/>
		);
	} else if (g.set.projectId)
		icon = (
			<span
				className="pdot"
				style={
					{
						"--c": projectColor(project(g.set.projectId)?.color),
					} as React.CSSProperties
				}
			/>
		);
	else
		icon = (
			<span
				className="icon-[solar--calendar-linear] size-3.5"
				aria-hidden="true"
			/>
		);
	return (
		<div ref={setNodeRef} className={cn("grp", isOver && "over")}>
			<button
				type="button"
				className="ibtn ibtn-xs"
				aria-expanded={open}
				aria-label="Toggle group"
				onClick={onToggle}
			>
				<span
					className={cn(
						open
							? "icon-[solar--alt-arrow-down-linear]"
							: "icon-[solar--alt-arrow-right-linear]",
						"size-[13px]",
					)}
					aria-hidden="true"
				/>
			</button>
			{icon}
			<span>{g.name}</span>
			<span className="cnt">{g.tasks.length}</span>
		</div>
	);
}

function Row({
	t,
	group,
	cols,
	tpl,
	complete,
	drag,
	selected,
	onSelect,
}: {
	t: TaskItem;
	group: string;
	cols: Col[];
	tpl: string;
	complete?: boolean;
	drag: boolean;
	selected: boolean;
	onSelect: () => void;
}) {
	const { update, openTask, canEdit } = useTaskView();
	const editable = canEdit(t.projectId);
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: t.id,
		data: { group },
		disabled: !editable || !drag,
	});
	const [editing, setEditing] = useState(false);
	const [title, setTitle] = useState(t.name);
	const [expanded, setExpanded] = useState(false);
	const done = t.status === "completed";
	const commit = () => {
		setEditing(false);
		const next = title.trim();
		if (next && next !== t.name) update(t, { title: next });
		else setTitle(t.name);
	};

	return (
		<>
			<div
				ref={setNodeRef}
				className={cn("trow", done && "done", selected && "sel")}
				style={
					{
						"--cols": tpl,
						transform: CSS.Transform.toString(transform),
						transition,
						opacity: isDragging ? 0.4 : undefined,
					} as React.CSSProperties
				}
			>
				<button
					type="button"
					className="handle"
					{...attributes}
					{...listeners}
					aria-label={`Drag ${t.name}`}
					disabled={!editable}
				>
					{editable && drag && (
						<span
							className="icon-[hugeicons--drag-drop-vertical] size-3.5"
							aria-hidden="true"
						/>
					)}
				</button>
				<div className="c-check">
					{complete ? (
						<input
							type="checkbox"
							className="check round"
							checked={done}
							disabled={!editable}
							aria-label={`Mark ${t.name} complete`}
							onChange={() =>
								update(t, { status: done ? "todo" : "completed" })
							}
						/>
					) : (
						<input
							type="checkbox"
							className="check"
							checked={selected}
							disabled={!editable}
							aria-label={`Select ${t.name}`}
							onChange={onSelect}
						/>
					)}
				</div>
				{/* biome-ignore lint/a11y/noStaticElementInteractions: the title text is the click target; the row's Open action is in its menu */}
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: same as above */}
				<div
					className="ttl"
					onClick={() => !editing && openTask(t.id)}
					onDoubleClick={() => editable && setEditing(true)}
				>
					{t.subtaskCount ? (
						<button
							type="button"
							className="ibtn ibtn-xs"
							style={{ marginLeft: -4 }}
							aria-label={expanded ? "Hide subtasks" : "Show subtasks"}
							aria-expanded={expanded}
							onClick={(e) => {
								e.stopPropagation();
								setExpanded(!expanded);
							}}
						>
							<span
								className={cn(
									expanded
										? "icon-[solar--alt-arrow-down-linear]"
										: "icon-[solar--alt-arrow-right-linear]",
									"size-[13px]",
								)}
								aria-hidden="true"
							/>
						</button>
					) : (
						<span style={{ width: 18, flexShrink: 0 }} />
					)}
					<span className="key">{t.key}</span>
					{editing ? (
						<input
							className="inline-in"
							value={title}
							aria-label="Task title"
							onChange={(e) => setTitle(e.target.value)}
							onBlur={commit}
							onKeyDown={(e) => {
								if (e.key === "Enter") commit();
								if (e.key === "Escape") {
									setTitle(t.name);
									setEditing(false);
								}
							}}
							onClick={(e) => e.stopPropagation()}
							// biome-ignore lint/a11y/noAutofocus: double-click opens the title for typing
							autoFocus
						/>
					) : (
						<span className="tt">{t.name}</span>
					)}
					{t.recur && (
						<span
							className="meta-mini"
							data-tip={`Repeats ${t.recur.toLowerCase()}`}
						>
							<span
								className="icon-[solar--repeat-linear] size-[11px]"
								aria-hidden="true"
							/>
						</span>
					)}
					{!!t.subtaskCount && (
						<span className="meta-mini">
							<span
								className="icon-[solar--checklist-minimalistic-linear] size-[11px]"
								aria-hidden="true"
							/>
							{t.subtaskDone}/{t.subtaskCount}
						</span>
					)}
					{!!t.commentCount && (
						<span className="meta-mini">
							<span
								className="icon-[solar--chat-round-line-linear] size-[11px]"
								aria-hidden="true"
							/>
							{t.commentCount}
						</span>
					)}
				</div>
				{cols.map((c) => {
					const Cell = CELL[c];
					return (
						<div key={c} className={`c-meta c-${c === "labels" ? "lbl" : c}`}>
							<Cell t={t} />
						</div>
					);
				})}
				<div className="c-more">
					<TaskMenu t={t} />
				</div>
			</div>
			{expanded && <SubRows parent={t} />}
		</>
	);
}

function SubRows({ parent }: { parent: TaskItem }) {
	const { slug, update, canEdit } = useTaskView();
	const { data } = useQuery<{
		workspace: { task: { subtasks: TaskItem[] } | null } | null;
	}>(SUBTASKS, {
		variables: { slug, id: parent.id },
	});
	const subs = data?.workspace?.task?.subtasks ?? [];
	return (
		<div className="subrows">
			{subs.map((s) => {
				const done = s.status === "completed";
				return (
					<div key={s.id} className={cn("subrow", done && "done")}>
						<input
							type="checkbox"
							className="check"
							checked={done}
							disabled={!canEdit(parent.projectId)}
							aria-label={`${done ? "Reopen" : "Complete"} subtask ${s.name}`}
							onChange={() =>
								update(s, { status: done ? "todo" : "completed" })
							}
						/>
						<span>{s.name}</span>
					</div>
				);
			})}
		</div>
	);
}

/** "Add task" at the end of a group; Enter adds and keeps it open (reference composer). */
function Composer({
	group,
	projectId,
}: {
	group: Group<TaskItem>;
	projectId: string;
}) {
	const { create, canEdit } = useTaskView();
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	if (!canEdit(projectId)) return null;
	if (!open)
		return (
			<button type="button" className="addrow" onClick={() => setOpen(true)}>
				<span
					className="icon-[hugeicons--plus-sign] size-3.5"
					aria-hidden="true"
				/>
				Add task
			</button>
		);
	return (
		<div className="addrow" style={{ background: "var(--q-surface-2)" }}>
			<span
				className="icon-[hugeicons--plus-sign] size-3.5"
				aria-hidden="true"
			/>
			<input
				className="inline-in"
				placeholder="Task name — press Enter to add, Esc to cancel"
				aria-label="New task name"
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				onKeyDown={async (e) => {
					if (e.key === "Escape") {
						setOpen(false);
						setTitle("");
					}
					if (e.key === "Enter" && title.trim()) {
						const name = title.trim();
						setTitle("");
						await create(
							{ projectId, title: name, ...group.set },
							{ quiet: true },
						);
					}
				}}
				onBlur={() => !title.trim() && setOpen(false)}
				// biome-ignore lint/a11y/noAutofocus: the composer opens to type a task name
				autoFocus
			/>
		</div>
	);
}

/** Actions for the selected rows (reference bulkBar); the board uses it too. */
export function BulkBar({
	ids,
	slug,
	onClear,
}: {
	ids: string[];
	slug: string;
	onClear: () => void;
}) {
	const { members } = useTaskView();
	const [deleting, setDeleting] = useState(false);
	const [bulk] = useMutation(BULK_UPDATE_TASKS, {
		refetchQueries: TASK_REFETCH,
	});
	const [remove] = useMutation(DELETE_TASKS, { refetchQueries: TASK_REFETCH });
	const undo = useUndoDelete(slug);
	if (!ids.length) return null;
	const apply = (patch: Record<string, string | null>) =>
		toast
			.promise(bulk({ variables: { slug, ids, patch } }), {
				loading: `Updating ${ids.length} task${ids.length > 1 ? "s" : ""}…`,
				success: ({ data }) =>
					`Updated ${count(data?.bulkUpdateTasks ?? ids.length, "task")}`,
				error: "Couldn't update those tasks",
			})
			.catch(() => {});
	return (
		<div className="bulkbar enter" role="toolbar" aria-label="Bulk actions">
			<b style={{ fontWeight: 600 }}>{ids.length} selected</b>
			<span className="sep" />
			<StatusPick value="" onPick={(status) => apply({ status })}>
				<button type="button" className="btn btn-sm">
					<span
						className="icon-[solar--record-circle-linear] size-3.5"
						aria-hidden="true"
					/>
					Status
				</button>
			</StatusPick>
			<AssigneePick
				value={null}
				people={members}
				onPick={(assigneeId) => apply({ assigneeId })}
			>
				<button type="button" className="btn btn-sm">
					<span
						className="icon-[solar--user-linear] size-3.5"
						aria-hidden="true"
					/>
					Assignee
				</button>
			</AssigneePick>
			<PriorityPick value="" onPick={(priority) => apply({ priority })}>
				<button type="button" className="btn btn-sm">
					<span
						className="icon-[solar--chart-2-linear] size-3.5"
						aria-hidden="true"
					/>
					Priority
				</button>
			</PriorityPick>
			<button
				type="button"
				className="btn btn-sm"
				onClick={() => setDeleting(true)}
			>
				<span
					className="icon-[solar--trash-bin-minimalistic-linear] size-3.5"
					aria-hidden="true"
				/>
				Delete
			</button>
			<span className="sep" />
			<button
				type="button"
				className="btn btn-sm"
				aria-label="Clear selection"
				onClick={onClear}
			>
				<span
					className="icon-[solar--close-circle-linear] size-3.5"
					aria-hidden="true"
				/>
			</button>
			<ConfirmModal
				open={deleting}
				onOpenChange={setDeleting}
				title={`Delete ${ids.length} task${ids.length > 1 ? "s" : ""}?`}
				body="Their subtasks are deleted too. You can undo this right after."
				ok="Delete"
				danger
				onConfirm={async () => {
					const label = `${ids.length} task${ids.length > 1 ? "s" : ""}`;
					const id = toast.pending(`Deleting ${label}…`);
					try {
						await remove({ variables: { slug, ids } });
						toast.update(id, {
							title: `Deleted ${label}`,
							type: "success",
							action: undo(ids),
						});
						onClear();
					} catch (error) {
						toast.update(id, {
							title: "Couldn't delete those tasks",
							desc: (error as Error).message,
							type: "error",
						});
					}
				}}
			/>
		</div>
	);
}
