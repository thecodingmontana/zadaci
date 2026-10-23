import {
	closestCorners,
	DndContext,
	type DragEndEvent,
	DragOverlay,
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
import { createContext, useContext, useEffect, useState } from "react";
import { ProgBar, projectColor } from "#/components/projects/bits";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuLabel,
	MenuTrigger,
} from "#/components/q/menu";
import { StatusIcon } from "#/components/q/status-icon";
import type { TaskItem } from "#/graphql/operations";
import { priority } from "#/lib/tasks";
import { cn } from "#/lib/utils";
import { type Group, groupTasks, planDrop } from "#/lib/view-engine";
import { Due, Lbl, PrIcon } from "./bits";
import { assigneeLabel, Faces, useAssignees } from "./cells";
import { useTaskView } from "./context";
import { BulkBar } from "./list-view";
import { AssigneesPick, DatePick, PriorityPick } from "./pick";
import { TaskMenu } from "./task-menu";

// The Board view (reference views/board.js): one column per status, cards you drag
// between columns to change status, or within one to reorder.

export function BoardView({
	tasks,
	projectId,
	showProject,
	storageKey,
}: {
	/** already filtered and searched by the toolbar */
	tasks: TaskItem[];
	/** where new cards go */
	projectId?: string;
	/** show each card's project dot (cross-project boards) */
	showProject?: boolean;
	storageKey: string;
}) {
	const { update, slug, canEdit } = useTaskView();
	const [dragging, setDragging] = useState<TaskItem | null>(null);
	// cards picked for a bulk change (Ctrl/⌘- or Shift-click, or a card's checkbox)
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const toggle = (id: string) =>
		setSelected((s) => {
			const next = new Set(s);
			if (!next.delete(id)) next.add(id);
			return next;
		});
	// only cards still on the board and still editable count
	const picked = tasks
		.filter((t) => selected.has(t.id) && canEdit(t.projectId))
		.map((t) => t.id);
	useEffect(() => {
		if (!picked.length) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setSelected(new Set());
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [picked.length]);
	const [collapsed, setCollapsed] = useCollapsed(storageKey);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);
	// columns keep manual order inside, like the reference board
	const columns = groupTasks(
		[...tasks].sort((a, b) => a.sortOrder - b.sortOrder),
		"status",
	);

	function onDragEnd({ active, over }: DragEndEvent) {
		setDragging(null);
		const task = tasks.find((t) => t.id === active.id);
		if (!over || !task) return;
		const toGroup = String(
			over.data.current?.group ?? String(over.id).replace(/^col:/, ""),
		);
		const plan = planDrop(
			columns,
			task.id,
			task.status,
			toGroup,
			String(over.id),
		);
		if (plan) update(task, { sortOrder: plan.sortOrder, ...plan.set });
	}

	return (
		<Selection.Provider value={{ selected, toggle }}>
			<DndContext
				sensors={sensors}
				collisionDetection={closestCorners}
				onDragStart={({ active }) =>
					setDragging(tasks.find((t) => t.id === active.id) ?? null)
				}
				onDragEnd={onDragEnd}
				onDragCancel={() => setDragging(null)}
			>
				<div className="board">
					{columns.map((col) =>
						collapsed.has(col.key) ? (
							<CollapsedColumn
								key={col.key}
								col={col}
								onExpand={() => setCollapsed(col.key, false)}
							/>
						) : (
							<Column
								key={col.key}
								col={col}
								projectId={projectId}
								showProject={showProject}
								onCollapse={() => setCollapsed(col.key, true)}
							/>
						),
					)}
				</div>
				<DragOverlay>
					{dragging && <Card t={dragging} showProject={showProject} overlay />}
				</DragOverlay>
			</DndContext>
			{picked.length > 0 && (
				<BulkBar
					ids={picked}
					slug={slug}
					onClear={() => setSelected(new Set())}
				/>
			)}
		</Selection.Provider>
	);
}

const Selection = createContext<{
	selected: Set<string>;
	toggle: (id: string) => void;
}>({ selected: new Set(), toggle: () => {} });

/** Collapsed columns, remembered per board in this browser. */
function useCollapsed(key: string) {
	const storage = `zadaci:board:${key}`;
	const [set, setSet] = useState<Set<string>>(new Set());
	// read after mount so the server and first client render agree
	useEffect(() => {
		try {
			setSet(new Set(JSON.parse(localStorage.getItem(storage) ?? "[]")));
		} catch {}
	}, [storage]);
	const update = (col: string, on: boolean) =>
		setSet((prev) => {
			const next = new Set(prev);
			on ? next.add(col) : next.delete(col);
			try {
				localStorage.setItem(storage, JSON.stringify([...next]));
			} catch {}
			return next;
		});
	return [set, update] as const;
}

function CollapsedColumn({
	col,
	onExpand,
}: {
	col: Group<TaskItem>;
	onExpand: () => void;
}) {
	const { setNodeRef } = useDroppable({
		id: `col:${col.key}`,
		data: { group: col.key },
	});
	return (
		<button
			ref={setNodeRef}
			type="button"
			className="bcol collapsed"
			aria-label={`Expand ${col.name}`}
			data-tip="Expand"
			onClick={onExpand}
		>
			<StatusIcon status={col.key} />
			<span className="vname">
				{col.name}
				<span className="faint">{col.tasks.length}</span>
			</span>
		</button>
	);
}

function Column({
	col,
	projectId,
	showProject,
	onCollapse,
}: {
	col: Group<TaskItem>;
	projectId?: string;
	showProject?: boolean;
	onCollapse: () => void;
}) {
	const { update, canEdit, projects } = useTaskView();
	const { setNodeRef, isOver } = useDroppable({
		id: `col:${col.key}`,
		data: { group: col.key },
	});
	const [composing, setComposing] = useState(false);
	// across projects (the Tasks page) new cards go to the first project you can edit,
	// like the reference falls back to a default project
	const target = projectId ?? projects.find((p) => canEdit(p.id))?.id;
	const editable = !!target && canEdit(target);
	const done = col.key === "completed";
	return (
		<section className={cn("bcol", isOver && "over")} aria-label={col.name}>
			<div className="bcol-h">
				<StatusIcon status={col.key} />
				<span>{col.name}</span>
				<span className="cnt">{col.tasks.length}</span>
				<span className="acts">
					{editable && (
						<button
							type="button"
							className="ibtn ibtn-xs"
							data-tip="Add task"
							aria-label={`Add task to ${col.name}`}
							onClick={() => setComposing(true)}
						>
							<span
								className="icon-[hugeicons--plus-sign] size-3.5"
								aria-hidden="true"
							/>
						</button>
					)}
					<Menu>
						<MenuTrigger className="ibtn ibtn-xs" aria-label="Column options">
							<span
								className="icon-[solar--menu-dots-bold] size-3.5"
								aria-hidden="true"
							/>
						</MenuTrigger>
						<MenuContent width={210}>
							<MenuLabel>{col.name}</MenuLabel>
							{editable && (
								<MenuItem
									icon="icon-[hugeicons--plus-sign]"
									onSelect={() => setComposing(true)}
								>
									Add task
								</MenuItem>
							)}
							<MenuItem
								icon="icon-[solar--minimize-square-linear]"
								onSelect={onCollapse}
							>
								Collapse column
							</MenuItem>
							{!done && col.tasks.some((t) => canEdit(t.projectId)) && (
								<MenuItem
									icon="icon-[solar--check-read-linear]"
									onSelect={() => {
										for (const t of col.tasks)
											if (canEdit(t.projectId))
												update(t, { status: "completed" });
									}}
								>
									Mark all as done
								</MenuItem>
							)}
							{col.tasks.some((t) => canEdit(t.projectId)) && (
								<MenuItem
									icon="icon-[solar--sort-vertical-linear]"
									onSelect={() => {
										const sorted = [...col.tasks].sort(
											(a, b) => priority(b.priority).w - priority(a.priority).w,
										);
										sorted.forEach((t, i) => {
											if (canEdit(t.projectId) && t.sortOrder !== i + 1)
												update(t, { sortOrder: i + 1 });
										});
									}}
								>
									Sort by priority
								</MenuItem>
							)}
						</MenuContent>
					</Menu>
				</span>
			</div>
			<SortableContext
				items={col.tasks.map((t) => t.id)}
				strategy={verticalListSortingStrategy}
			>
				<div ref={setNodeRef} className="bcol-b">
					{col.tasks.map((t) => (
						<SortableCard
							key={t.id}
							t={t}
							group={col.key}
							showProject={showProject}
						/>
					))}
					{composing && target ? (
						<Composer
							status={col.key}
							projectId={target}
							onClose={() => setComposing(false)}
						/>
					) : (
						editable && (
							<button
								type="button"
								className="addcard"
								onClick={() => setComposing(true)}
							>
								<span
									className="icon-[hugeicons--plus-sign] size-3.5"
									aria-hidden="true"
								/>
								Add task
							</button>
						)
					)}
				</div>
			</SortableContext>
		</section>
	);
}

function SortableCard({
	t,
	group,
	showProject,
}: {
	t: TaskItem;
	group: string;
	showProject?: boolean;
}) {
	const { canEdit } = useTaskView();
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
		disabled: !canEdit(t.projectId),
	});
	return (
		<div
			ref={setNodeRef}
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
				opacity: isDragging ? 0.35 : undefined,
			}}
			{...attributes}
			{...listeners}
		>
			<Card t={t} showProject={showProject} />
		</div>
	);
}

/** One card (reference kcard). */
function Card({
	t,
	showProject,
	overlay,
}: {
	t: TaskItem;
	showProject?: boolean;
	overlay?: boolean;
}) {
	const { update, openTask, canEdit, project, members } = useTaskView();
	const { selected, toggle } = useContext(Selection);
	const editable = canEdit(t.projectId) && !overlay;
	const isSelected = selected.has(t.id);
	const done = t.status === "completed";
	const p = project(t.projectId);
	const people = useAssignees(t.assigneeIds);
	const pct = t.subtaskCount
		? Math.round((t.subtaskDone / t.subtaskCount) * 100)
		: 0;
	const stop = (e: React.SyntheticEvent) => e.stopPropagation();
	return (
		// biome-ignore lint/a11y/useSemanticElements: the card holds its own buttons, so it can't be one
		<div
			className={cn("kcard", done && "done", isSelected && "sel")}
			role="button"
			tabIndex={0}
			aria-label={t.name}
			aria-pressed={editable ? isSelected : undefined}
			style={
				overlay
					? { boxShadow: "var(--q-shadow-pop)", cursor: "grabbing" }
					: undefined
			}
			onClick={(e) => {
				// a modifier-click picks the card for a bulk change instead of opening it
				if (editable && (e.metaKey || e.ctrlKey || e.shiftKey)) toggle(t.id);
				else openTask(t.id);
			}}
			onKeyDown={(e) => {
				if (e.target === e.currentTarget && e.key === "Enter") openTask(t.id);
			}}
		>
			{editable && (
				<input
					type="checkbox"
					className="check ksel"
					aria-label={`Select ${t.name}`}
					checked={isSelected}
					onClick={stop}
					onPointerDown={stop}
					onChange={() => toggle(t.id)}
				/>
			)}
			{!!t.labels.length && (
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
						role="img"
						aria-label="Done"
					>
						<StatusIcon status="completed" />
					</span>
				)}
				<div className="title">{t.name}</div>
			</div>
			{!!t.subtaskCount && (
				<div className="subp">
					<span
						className="icon-[solar--checklist-minimalistic-linear] size-3"
						aria-hidden="true"
					/>
					<span className="num">
						{t.subtaskDone}/{t.subtaskCount}
					</span>
					<ProgBar
						value={pct}
						tone={t.subtaskDone === t.subtaskCount ? "green" : undefined}
					/>
				</div>
			)}
			<div className="meta">
				{showProject && p && (
					<span className="m" data-tip={p.title}>
						<span
							className="pdot"
							style={{ "--c": projectColor(p.color) } as React.CSSProperties}
						/>
					</span>
				)}
				<span className="key">{t.key}</span>
				{editable ? (
					<PriorityPick
						value={t.priority}
						onPick={(v) => update(t, { priority: v })}
					>
						<button
							type="button"
							className="m"
							data-tip={priority(t.priority).name}
							aria-label={`Priority: ${priority(t.priority).name}`}
							onClick={stop}
						>
							<PrIcon p={t.priority} size={13} />
						</button>
					</PriorityPick>
				) : (
					<span className="m">
						<PrIcon p={t.priority} size={13} />
					</span>
				)}
				{t.dueDate &&
					(editable ? (
						<DatePick
							value={t.dueDate}
							onPick={(d) => update(t, { dueDate: d })}
						>
							<button
								type="button"
								className="m"
								aria-label="Due date"
								onClick={stop}
							>
								<Due day={t.dueDate} status={t.status} />
							</button>
						</DatePick>
					) : (
						<span className="m">
							<Due day={t.dueDate} status={t.status} />
						</span>
					))}
				{t.recur && (
					<span className="m" data-tip={`Repeats ${t.recur.toLowerCase()}`}>
						<span
							className="icon-[solar--repeat-linear] size-3"
							aria-hidden="true"
						/>
					</span>
				)}
				{!!t.commentCount && (
					<span className="m" data-tip={`${t.commentCount} comments`}>
						<span
							className="icon-[solar--chat-round-line-linear] size-3"
							aria-hidden="true"
						/>
						{t.commentCount}
						<span className="sr-only"> comments</span>
					</span>
				)}
				{!!t.attachmentCount && (
					<span className="m" data-tip={`${t.attachmentCount} attachments`}>
						<span
							className="icon-[solar--paperclip-linear] size-3"
							aria-hidden="true"
						/>
						{t.attachmentCount}
						<span className="sr-only"> attachments</span>
					</span>
				)}
				{editable ? (
					<AssigneesPick
						value={t.assigneeIds}
						people={members}
						onChange={(ids) => update(t, { assigneeIds: ids })}
					>
						<button
							type="button"
							className="m"
							style={{ marginLeft: "auto" }}
							aria-label={`Assignees: ${assigneeLabel(people)}`}
							onClick={stop}
						>
							<Faces people={people} />
						</button>
					</AssigneesPick>
				) : (
					<span className="m" style={{ marginLeft: "auto" }}>
						{people.length > 0 && <Faces people={people} />}
					</span>
				)}
			</div>
			{editable && (
				// biome-ignore lint/a11y/noStaticElementInteractions: keeps hover actions from opening the card
				// biome-ignore lint/a11y/useKeyWithClickEvents: same as above
				<div className="hacts" onClick={stop}>
					<button
						type="button"
						className="ibtn ibtn-xs"
						data-tip={done ? "Reopen" : "Mark complete"}
						aria-label={done ? "Reopen" : "Mark complete"}
						onClick={() => update(t, { status: done ? "todo" : "completed" })}
					>
						<span
							className={cn(
								done
									? "icon-[solar--restart-linear]"
									: "icon-[hugeicons--tick-02]",
								"size-[13px]",
							)}
							aria-hidden="true"
						/>
					</button>
					<button
						type="button"
						className="ibtn ibtn-xs"
						data-tip="Quick edit"
						aria-label="Quick edit"
						onClick={() => openTask(t.id)}
					>
						<span
							className="icon-[solar--pen-linear] size-3"
							aria-hidden="true"
						/>
					</button>
					<TaskMenu t={t} className="ibtn ibtn-xs" />
				</div>
			)}
		</div>
	);
}

/** New card at the bottom of a column (reference composer): Enter adds, Esc cancels. */
function Composer({
	status,
	projectId,
	onClose,
}: {
	status: string;
	projectId: string;
	onClose: () => void;
}) {
	const { create } = useTaskView();
	const [title, setTitle] = useState("");
	// the card appears at once (optimistic); the box stays open for the next one
	const add = () => {
		const name = title.trim();
		if (!name) return;
		setTitle("");
		void create({ projectId, title: name, status }, { quiet: true });
	};
	return (
		<div className="composer">
			<textarea
				placeholder="Task name"
				rows={2}
				aria-label="New task name"
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						add();
					}
					if (e.key === "Escape") onClose();
				}}
				// biome-ignore lint/a11y/noAutofocus: the composer opens to type a task name
				autoFocus
			/>
			<div className="row">
				<span className="faint" style={{ fontSize: 11 }}>
					Enter to add · Esc to close
				</span>
				<span className="sp" />
				<button
					type="button"
					className="btn btn-sm btn-ghost"
					onClick={onClose}
				>
					Done
				</button>
				<button type="button" className="btn btn-sm btn-primary" onClick={add}>
					Add
				</button>
			</div>
		</div>
	);
}
