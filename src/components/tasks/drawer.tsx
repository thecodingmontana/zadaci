import type { TypedDocumentNode } from "@apollo/client";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { Link, useNavigate } from "@tanstack/react-router";
import DOMPurify from "dompurify";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { ProgBar, projectColor } from "#/components/projects/bits";
import { Av } from "#/components/q/av";
import { StatusIcon } from "#/components/q/status-icon";
import {
	type ActivityItem,
	REMOVE_ATTACHMENT,
	SET_DEPENDENCIES,
	TASK_DETAIL,
	type TaskAttachment,
	type TaskDetail,
	type TaskItem,
	TOGGLE_TASK_FAVORITE,
} from "#/graphql/operations";
import { FILE_TYPES, fileKind, fmtSize } from "#/lib/files";
import { ESTIMATES, RECURS } from "#/lib/tasks";
import { ago, daysUntil, relDay } from "#/lib/time";
import { copy, toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { isOverdue } from "#/lib/view-engine";
import {
	CellAssignee,
	CellDue,
	CellLabels,
	CellPrio,
	CellProject,
	CellStatus,
} from "./cells";
import { TASK_REFETCH, TaskViewProvider, useTaskView } from "./context";
import { DrawerConversation } from "./drawer-conversation";
import { FilePreviewModal, Preview } from "./files-view";
import { DatePick, PickList, PickPopover } from "./pick";
import { TaskMenu } from "./task-menu";
import { useUploads } from "./use-uploads";

// The task drawer (reference overlays/drawer.js drawerHtml), opened from any page with
// ?task=<id>. Subtasks are tasks too, so opening one shows it here with a way back.

export function TaskDrawer({
	slug,
	taskId,
	onClose,
	onOpen,
}: {
	slug: string;
	taskId: string;
	onClose: () => void;
	onOpen: (id: string) => void;
}) {
	const { data, loading } = useQuery(TASK_DETAIL, {
		variables: { slug, id: taskId },
		fetchPolicy: "cache-and-network",
	});
	const [full, setFull] = useState(false);
	const workspace = data?.workspace;
	const task = workspace?.task;
	const navigate = useNavigate();
	const shown = useRef(false);
	if (task) shown.current = true;
	// a link to a deleted task goes to the Tasks page; one deleted while open just closes
	useEffect(() => {
		if (loading || !workspace || task) return;
		if (shown.current) return onClose();
		toast.info("That task doesn't exist anymore");
		navigate({ to: "/w/$slug/tasks", params: { slug } });
	}, [loading, workspace, task, navigate, slug, onClose]);

	// Esc closes the drawer unless a picker or menu is open on top of it
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape" || e.defaultPrevented) return;
			if (document.querySelector(".pop, [role=dialog]:not(.drawer)")) return;
			onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<>
			{full && (
				// biome-ignore lint/a11y/noStaticElementInteractions: the scrim is a mouse shortcut; Esc and the close button also close
				// biome-ignore lint/a11y/useKeyWithClickEvents: same as above
				<div className="drawer-scrim full enter" onClick={onClose} />
			)}
			<aside
				className={cn("drawer enter", full && "full")}
				role="dialog"
				aria-modal={full}
				aria-labelledby="d-h"
				tabIndex={-1}
			>
				{!workspace || !task ? (
					<>
						<div className="drawer-h">
							{loading && (
								<>
									<span
										className="sk"
										style={{ width: 120, height: 22, borderRadius: 6 }}
									/>
									<span className="sk" style={{ width: 52, height: 10 }} />
								</>
							)}
							<span className="sp" />
							<button
								type="button"
								className="ibtn ibtn-sm"
								aria-label="Close"
								onClick={onClose}
							>
								<span
									className="icon-[solar--close-circle-linear] size-4"
									aria-hidden="true"
								/>
							</button>
						</div>
						<div className="drawer-b">
							<h2 className="sr" id="d-h">
								Task
							</h2>
							{loading ? (
								<DrawerSkeleton />
							) : (
								<p className="faint">
									This task doesn't exist or you can't see it.
								</p>
							)}
						</div>
					</>
				) : (
					<TaskViewProvider
						slug={slug}
						members={workspace.members}
						projects={workspace.projects}
					>
						<DrawerBody
							t={task}
							activity={workspace.activity}
							full={full}
							setFull={setFull}
							onClose={onClose}
							onOpen={onOpen}
						/>
					</TaskViewProvider>
				)}
			</aside>
		</>
	);
}

function DrawerBody({
	t,
	activity,
	full,
	setFull,
	onClose,
	onOpen,
}: {
	t: TaskDetail;
	activity: ActivityItem[];
	full: boolean;
	setFull: (full: boolean) => void;
	onClose: () => void;
	onOpen: (id: string) => void;
}) {
	const { slug, update, canEdit, project } = useTaskView();
	const editable = canEdit(t.projectId);
	const p = project(t.projectId);
	const done = t.status === "completed";
	const [favorite] = useMutation(TOGGLE_TASK_FAVORITE, {
		refetchQueries: TASK_REFETCH,
	});
	const prop = (icon: string, label: string, value: ReactNode) => (
		<>
			<dt>
				<span className={cn(icon, "size-3.5")} aria-hidden="true" />
				{label}
			</dt>
			<dd>{value}</dd>
		</>
	);
	const overBy = t.dueDate ? -daysUntil(t.dueDate) : 0;

	return (
		<>
			<h2 className="sr" id="d-h">
				{t.parentId ? "Subtask" : "Task"}: {t.name}
			</h2>
			<div className="drawer-h">
				{t.parentId ? (
					<button
						type="button"
						className="btn btn-sm btn-ghost"
						onClick={() => onOpen(t.parentId as string)}
					>
						<span
							className="icon-[solar--arrow-left-linear] size-3.5"
							aria-hidden="true"
						/>
						Parent task
					</button>
				) : (
					p && (
						<Link
							to="/w/$slug/p/$projectId"
							params={{ slug, projectId: p.id }}
							search={{ tab: "board" }}
							className="pillbtn"
							style={{ fontSize: 12.5 }}
						>
							<span
								className="pdot"
								style={{ "--c": projectColor(p.color) } as React.CSSProperties}
							/>
							{p.title}
						</Link>
					)
				)}
				<span className="faint">/</span>
				<span
					className="mono faint"
					style={{ fontSize: 11.5, padding: "0 6px" }}
				>
					{t.key}
				</span>
				<span className="sp" />
				{editable && (
					<button
						type="button"
						className={cn("btn btn-sm", done ? "btn-secondary" : "btn-ghost")}
						style={done ? { color: "var(--q-green)" } : undefined}
						onClick={() => update(t, { status: done ? "todo" : "completed" })}
					>
						<span
							className={cn(
								done
									? "icon-[solar--check-circle-bold]"
									: "icon-[solar--check-circle-linear]",
								"size-3.5",
							)}
							aria-hidden="true"
						/>
						<span className="hide-m">
							{done ? "Completed" : "Mark complete"}
						</span>
					</button>
				)}
				<button
					type="button"
					className="ibtn ibtn-sm"
					data-tip={t.isFavorite ? "Unfavorite" : "Favorite"}
					aria-pressed={t.isFavorite}
					aria-label="Favorite"
					style={t.isFavorite ? { color: "var(--q-amber)" } : undefined}
					onClick={() => favorite({ variables: { slug, id: t.id } })}
				>
					<span
						className={cn(
							t.isFavorite
								? "icon-[solar--star-bold]"
								: "icon-[solar--star-linear]",
							"size-[15px]",
						)}
						aria-hidden="true"
					/>
				</button>
				<button
					type="button"
					className="ibtn ibtn-sm"
					data-tip="Copy link"
					aria-label="Copy link"
					onClick={() => {
						copy(`${location.origin}/w/${slug}/p/${t.projectId}?task=${t.id}`);
					}}
				>
					<span
						className="icon-[solar--link-linear] size-[15px]"
						aria-hidden="true"
					/>
				</button>
				<button
					type="button"
					className="ibtn ibtn-sm hide-m"
					data-tip={full ? "Side panel" : "Full page"}
					aria-label="Toggle full page"
					onClick={() => setFull(!full)}
				>
					<span
						className={cn(
							full
								? "icon-[solar--minimize-square-linear]"
								: "icon-[solar--maximize-square-linear]",
							"size-[15px]",
						)}
						aria-hidden="true"
					/>
				</button>
				<TaskMenu t={t} />
				<button
					type="button"
					className="ibtn ibtn-sm"
					data-tip="Close  Esc"
					aria-label="Close"
					onClick={onClose}
				>
					<span
						className="icon-[solar--close-circle-linear] size-4"
						aria-hidden="true"
					/>
				</button>
			</div>
			<div className="drawer-b">
				{done ? (
					<div className="alert ok" style={{ marginBottom: 12 }}>
						<span
							className="i icon-[solar--check-circle-linear] size-[15px]"
							aria-hidden="true"
						/>
						<span>
							Completed {t.completedAt ? ago(t.completedAt) : ""}.{" "}
							{editable && (
								<button
									type="button"
									className="link"
									onClick={() => update(t, { status: "todo" })}
								>
									Reopen task
								</button>
							)}
						</span>
					</div>
				) : (
					isOverdue(t) && (
						<div className="alert danger" style={{ marginBottom: 12 }}>
							<span
								className="i icon-[solar--alarm-linear] size-[15px]"
								aria-hidden="true"
							/>
							<span>
								Overdue by {overBy} day{overBy > 1 ? "s" : ""}.{" "}
								{editable && (
									<DatePick
										value={t.dueDate}
										onPick={(d) => update(t, { dueDate: d })}
									>
										<button type="button" className="link">
											Reschedule
										</button>
									</DatePick>
								)}
							</span>
						</div>
					)
				)}
				<TitleEdit t={t} editable={editable} />
				<dl
					className="kv"
					style={{
						marginTop: 12,
						...(full && {
							gridTemplateColumns: "112px minmax(0,1fr) 112px minmax(0,1fr)",
						}),
					}}
				>
					{prop(
						"icon-[solar--record-circle-linear]",
						"Status",
						<CellStatus t={t} />,
					)}
					{prop("icon-[solar--chart-2-linear]", "Priority", <CellPrio t={t} />)}
					{prop(
						"icon-[solar--user-linear]",
						"Assignee",
						<CellAssignee t={t} />,
					)}
					{prop("icon-[solar--calendar-linear]", "Due date", <CellDue t={t} />)}
					{prop(
						"icon-[solar--calendar-add-linear]",
						"Start date",
						<CellDue t={t} field="startDate" />,
					)}
					{prop(
						"icon-[solar--folder-linear]",
						"Project",
						<CellProject t={t} />,
					)}
					{prop(
						"icon-[solar--tag-linear]",
						"Labels",
						<CellLabels t={t} wrap />,
					)}
					{prop(
						"icon-[solar--repeat-linear]",
						"Repeat",
						<RecurCell t={t} editable={editable} />,
					)}
					{prop(
						"icon-[solar--stopwatch-linear]",
						"Estimate",
						<EstimateCell t={t} editable={editable} />,
					)}
					{!t.parentId &&
						prop(
							"icon-[solar--routing-2-linear]",
							"Blocked by",
							<DepsCell t={t} editable={editable} />,
						)}
				</dl>
				<Description t={t} editable={editable} />
				{!t.parentId && <Subtasks t={t} editable={editable} onOpen={onOpen} />}
				<Attachments t={t} editable={editable} />
				<DrawerConversation t={t} activity={activity} />
			</div>
		</>
	);
}

function TitleEdit({ t, editable }: { t: TaskDetail; editable: boolean }) {
	const { update } = useTaskView();
	const [title, setTitle] = useState(t.name);
	const ref = useRef<HTMLTextAreaElement>(null);
	useEffect(() => setTitle(t.name), [t.name]);
	// grow with the text, like the reference data-autosize
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the title changes
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${el.scrollHeight}px`;
	}, [title]);
	return (
		<textarea
			ref={ref}
			className="ttl-edit"
			rows={1}
			aria-label="Task title"
			value={title}
			readOnly={!editable}
			onChange={(e) => setTitle(e.target.value)}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					e.currentTarget.blur();
				}
			}}
			onBlur={() => {
				const next = title.trim();
				if (next && next !== t.name) update(t, { title: next });
				else setTitle(t.name);
			}}
		/>
	);
}

function OptionCell({
	editable,
	empty,
	value,
	icon,
	items,
	onPick,
}: {
	editable: boolean;
	empty: string;
	value: string | null;
	icon: string;
	items: { id: string; name: string; on: boolean }[];
	onPick: (id: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const body = (
		<>
			<span className={cn(icon, "size-[13px]")} aria-hidden="true" />
			{value ?? empty}
		</>
	);
	if (!editable)
		return (
			<span
				className={cn("pillbtn", !value && "empty")}
				style={{ cursor: "default" }}
			>
				{body}
			</span>
		);
	return (
		<PickPopover
			open={open}
			onOpenChange={setOpen}
			width={200}
			trigger={
				<button type="button" className={cn("pillbtn", !value && "empty")}>
					{body}
				</button>
			}
		>
			<PickList
				items={items.map((it) => ({
					...it,
					icon: <span className={cn(icon, "size-3.5")} aria-hidden="true" />,
				}))}
				onPick={(id) => {
					setOpen(false);
					onPick(id);
				}}
			/>
		</PickPopover>
	);
}

function RecurCell({ t, editable }: { t: TaskDetail; editable: boolean }) {
	const { update } = useTaskView();
	return (
		<OptionCell
			editable={editable}
			empty="Does not repeat"
			value={t.recur}
			icon="icon-[solar--repeat-linear]"
			items={[
				{ id: "", name: "Does not repeat", on: !t.recur },
				...RECURS.map((r) => ({ id: r, name: r, on: t.recur === r })),
			]}
			onPick={(id) => update(t, { recur: id || null })}
		/>
	);
}

function EstimateCell({ t, editable }: { t: TaskDetail; editable: boolean }) {
	const { update } = useTaskView();
	return (
		<OptionCell
			editable={editable}
			empty="Add estimate"
			value={t.estimate}
			icon="icon-[solar--stopwatch-linear]"
			items={[
				...ESTIMATES.map((e) => ({ id: e, name: e, on: t.estimate === e })),
				{ id: "", name: "Clear estimate", on: false },
			]}
			onPick={(id) => update(t, { estimate: id || null })}
		/>
	);
}

/** "Blocked by": other tasks in the same project (reference deps popover). */
function DepsCell({ t, editable }: { t: TaskDetail; editable: boolean }) {
	const { slug } = useTaskView();
	const { data } = useQuery(TASK_DETAIL_SIBLINGS, {
		variables: { slug, projectId: t.projectId },
	});
	const [setDeps] = useMutation(SET_DEPENDENCIES, {
		refetchQueries: TASK_REFETCH,
	});
	const siblings = (data?.workspace?.tasks ?? []).filter((x) => x.id !== t.id);
	const deps = siblings.filter((x) => t.dependsOn.includes(x.id));
	const style = { height: "auto", minHeight: 26, flexWrap: "wrap" as const };
	const body = deps.length ? (
		deps.map((d) => (
			<span key={d.id} className="row" style={{ gap: 4 }}>
				<span className="depchip mono">{d.key}</span>
				<span className="trunc" style={{ maxWidth: 160 }}>
					{d.name}
				</span>
			</span>
		))
	) : (
		<>
			<span
				className="icon-[solar--routing-2-linear] size-[13px]"
				aria-hidden="true"
			/>
			None
		</>
	);
	if (!editable)
		return (
			<span
				className={cn("pillbtn", !deps.length && "empty")}
				style={{ ...style, cursor: "default" }}
			>
				{body}
			</span>
		);
	return (
		<PickPopover
			width={320}
			trigger={
				<button
					type="button"
					className={cn("pillbtn", !deps.length && "empty")}
					style={style}
				>
					{body}
				</button>
			}
		>
			<PickList
				search="Blocked by…"
				items={siblings.map((x) => ({
					id: x.id,
					name: `${x.key}  ${x.name}`,
					icon: <StatusIcon status={x.status} />,
					on: t.dependsOn.includes(x.id),
				}))}
				onPick={(id) =>
					toast
						.promise(
							setDeps({
								variables: {
									slug,
									id: t.id,
									dependsOn: t.dependsOn.includes(id)
										? t.dependsOn.filter((d) => d !== id)
										: [...t.dependsOn, id],
								},
							}),
							{
								loading: "Updating dependencies…",
								success: "Dependencies updated",
								error: "Couldn't update dependencies",
							},
						)
						.catch(() => {})
				}
			/>
		</PickPopover>
	);
}

const ALLOWED = {
	ALLOWED_TAGS: [
		"p",
		"br",
		"b",
		"strong",
		"i",
		"em",
		"u",
		"ul",
		"ol",
		"li",
		"h4",
		"a",
		"div",
	],
	ALLOWED_ATTR: ["href"],
};
/** Keeps only simple formatting; descriptions are written by other people. */
const clean = (html: string) => DOMPurify.sanitize(html, ALLOWED);

/** Rich text with the reference toolbar; saved when you leave the editor. */
function Description({ t, editable }: { t: TaskDetail; editable: boolean }) {
	const { update } = useTaskView();
	const ref = useRef<HTMLDivElement>(null);
	// sanitize in the browser only; the editor isn't server-rendered
	useEffect(() => {
		if (ref.current && document.activeElement !== ref.current)
			ref.current.innerHTML = clean(t.description ?? "");
	}, [t.description]);
	const cmd = (command: string) => {
		ref.current?.focus();
		if (command === "createLink") {
			const url = prompt("Link to");
			if (url && /^https?:\/\//.test(url))
				document.execCommand("createLink", false, url);
		} else if (command === "h4")
			document.execCommand("formatBlock", false, "h4");
		else document.execCommand(command);
	};
	return (
		<div className="dsec">
			<div className="dsec-h">
				<h3 id="d-desc-l">Description</h3>
				{editable && (
					<div
						className="rte-tb"
						role="toolbar"
						aria-label="Formatting"
						aria-controls="d-desc"
					>
						{(
							[
								["bold", "icon-[solar--text-bold-linear]", "Bold"],
								["italic", "icon-[solar--text-italic-linear]", "Italic"],
								[
									"insertUnorderedList",
									"icon-[solar--list-linear]",
									"Bulleted list",
								],
								[
									"insertOrderedList",
									"icon-[solar--list-check-linear]",
									"Numbered list",
								],
								["h4", "icon-[solar--text-linear]", "Heading"],
								["createLink", "icon-[solar--link-linear]", "Link"],
							] as const
						).map(([c, icon, label]) => (
							<button
								key={c}
								type="button"
								className="ibtn ibtn-xs"
								data-tip={label}
								aria-label={label}
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => cmd(c)}
							>
								<span className={cn(icon, "size-[13px]")} aria-hidden="true" />
							</button>
						))}
					</div>
				)}
			</div>
			<div className="rte">
				{/* biome-ignore lint/a11y/useSemanticElements: rich text needs a contenteditable element, not a textarea */}
				<div
					ref={ref}
					className="rte-body"
					id="d-desc"
					contentEditable={editable}
					suppressContentEditableWarning
					data-ph="Add a description…"
					role="textbox"
					tabIndex={0}
					aria-multiline="true"
					aria-labelledby="d-desc-l"
					onBlur={() => {
						const html = clean(ref.current?.innerHTML ?? "");
						const text = (ref.current?.textContent ?? "").trim();
						const next = text ? html : "";
						if (next !== (t.description ?? ""))
							update(t, { description: next || null });
					}}
				/>
			</div>
		</div>
	);
}

function Subtasks({
	t,
	editable,
	onOpen,
}: {
	t: TaskDetail;
	editable: boolean;
	onOpen: (id: string) => void;
}) {
	const { update, create, member } = useTaskView();
	const [title, setTitle] = useState("");
	const done = t.subtasks.filter((s) => s.status === "completed").length;
	const pct = t.subtasks.length
		? Math.round((done / t.subtasks.length) * 100)
		: 0;
	return (
		<div className="dsec">
			<div className="dsec-h">
				<h3>Subtasks</h3>
				<span className="cnt num">
					{done}/{t.subtasks.length}
				</span>
				{!!t.subtasks.length && (
					<span style={{ width: 90, display: "flex" }}>
						<ProgBar
							value={pct}
							tone={done === t.subtasks.length ? "green" : undefined}
						/>
					</span>
				)}
			</div>
			{t.subtasks.map((s) => {
				const sDone = s.status === "completed";
				const m = member(s.assigneeId);
				return (
					<div key={s.id} className={cn("subt", sDone && "done")}>
						<input
							type="checkbox"
							className="check"
							checked={sDone}
							disabled={!editable}
							aria-label={`${sDone ? "Reopen" : "Complete"} subtask ${s.name}`}
							onChange={() =>
								update(s, { status: sDone ? "todo" : "completed" })
							}
						/>
						<button type="button" className="s" onClick={() => onOpen(s.id)}>
							{s.name}
						</button>
						{s.dueDate && (
							<span
								className={cn(
									"due",
									!sDone && daysUntil(s.dueDate) < 0 && "over",
								)}
							>
								<span
									className="icon-[solar--calendar-linear] size-3"
									aria-hidden="true"
								/>
								{relDay(s.dueDate)}
							</span>
						)}
						{m && <Av name={m.name} image={m.image} className="sm" />}
						<button
							type="button"
							className="ibtn ibtn-xs x"
							aria-label="Open subtask details"
							tabIndex={-1}
							onClick={() => onOpen(s.id)}
						>
							<span
								className="icon-[solar--alt-arrow-right-linear] size-3.5"
								aria-hidden="true"
							/>
						</button>
					</div>
				);
			})}
			{editable && (
				<div className="subt" style={{ color: "var(--q-text-3)" }}>
					<span
						className="icon-[hugeicons--plus-sign] size-[15px]"
						aria-hidden="true"
					/>
					<input
						className="inline-in"
						placeholder="Add subtask"
						aria-label="Add subtask"
						style={{ fontSize: 13.5 }}
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						onKeyDown={async (e) => {
							if (e.key === "Enter" && title.trim()) {
								const name = title.trim();
								setTitle("");
								await create({
									projectId: t.projectId,
									parentId: t.id,
									title: name,
									status: "todo",
								});
							}
						}}
					/>
				</div>
			)}
		</div>
	);
}

/** Files on the task, uploaded straight to Cloudinary with a signed request. */
function Attachments({ t, editable }: { t: TaskDetail; editable: boolean }) {
	const { slug, member } = useTaskView();
	const { uploads, upload, picker } = useUploads(
		slug,
		{ taskId: t.id },
		TASK_REFETCH,
	);
	const [preview, setPreview] = useState<TaskAttachment | null>(null);
	const [remove] = useMutation(REMOVE_ATTACHMENT, {
		refetchQueries: TASK_REFETCH,
	});

	return (
		<div className="dsec">
			<div className="dsec-h">
				<h3>Attachments</h3>
				<span className="cnt">{t.attachments.length}</span>
				{editable && (
					<div className="acts">
						{picker(
							<>
								<span
									className="icon-[solar--upload-linear] size-[13px]"
									aria-hidden="true"
								/>
								Upload
							</>,
							"btn btn-sm btn-ghost",
						)}
					</div>
				)}
			</div>
			{uploads.map((x) => {
				const k = FILE_TYPES[fileKind(x.name)];
				return (
					<div key={x.id} className="upl" style={{ marginBottom: 6 }}>
						<span
							className="ftype"
							style={{ "--c": k.c } as React.CSSProperties}
						>
							<span className={cn(k.icon, "size-3.5")} aria-hidden="true" />
						</span>
						<div className="grow">
							<div className="row">
								<span className="trunc">{x.name}</span>
								<span className="sp" />
								<span className="faint num" style={{ fontSize: 11 }}>
									{x.pct}%
								</span>
							</div>
							<div className="prog" style={{ marginTop: 5 }}>
								<i style={{ width: `${x.pct}%` }} />
							</div>
						</div>
					</div>
				);
			})}
			{t.attachments.length ? (
				<div className="att">
					{t.attachments.map((f) => {
						const kind = fileKind(f.name);
						const k = FILE_TYPES[kind];
						return (
							<div key={f.id} className="attc">
								<button
									type="button"
									className="fprev"
									aria-label={`Preview ${f.name}`}
									onClick={() => setPreview(f)}
								>
									<Preview f={f} />
								</button>
								<div className="fi">
									<div className="trunc" style={{ fontWeight: 500 }}>
										{f.name}
									</div>
									<div className="faint">
										{k.name} · {fmtSize(f.size)}
									</div>
								</div>
								{editable && (
									<button
										type="button"
										className="ibtn ibtn-xs x"
										aria-label={`Remove ${f.name}`}
										onClick={() =>
											toast
												.promise(remove({ variables: { slug, id: f.id } }), {
													loading: `Removing ${f.name}…`,
													success: `Removed ${f.name}`,
													error: "Couldn't remove the file",
												})
												.catch(() => {})
										}
									>
										<span
											className="icon-[solar--close-circle-linear] size-3"
											aria-hidden="true"
										/>
									</button>
								)}
							</div>
						);
					})}
				</div>
			) : (
				!uploads.length &&
				editable && (
					// biome-ignore lint/a11y/noStaticElementInteractions: the drop target also wraps a file input for keyboard users
					<div
						onDragOver={(e) => e.preventDefault()}
						onDrop={(e) => {
							e.preventDefault();
							if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
						}}
					>
						{picker(
							<>
								<span
									className="icon-[solar--paperclip-linear] size-[15px]"
									aria-hidden="true"
								/>
								<span>Drop files or click to attach</span>
							</>,
							"dropzone",
							{ padding: 12 },
						)}
					</div>
				)
			)}
			<FilePreviewModal
				f={preview}
				onOpenChange={(o) => !o && setPreview(null)}
				uploader={preview ? member(preview.uploadedBy)?.name : undefined}
				attachedTo={t.name}
				// already on this task: the link just closes the preview
				onOpenTask={() => setPreview(null)}
			/>
		</div>
	);
}

/** The project's other tasks, for the "Blocked by" picker. */
const TASK_DETAIL_SIBLINGS: TypedDocumentNode<
	{
		workspace: {
			id: string;
			tasks: Pick<TaskItem, "id" | "key" | "name" | "status">[];
		} | null;
	},
	{ slug: string; projectId: string }
> = gql`
	query TaskSiblings($slug: String!, $projectId: ID!) {
		workspace(slug: $slug) {
			id
			tasks(projectId: $projectId) {
				id
				key
				name
				status
			}
		}
	}
`;

const SKELETON_PROPS = [
	["icon-[solar--record-circle-linear]", "Status", 70],
	["icon-[solar--chart-2-linear]", "Priority", 64],
	["icon-[solar--user-linear]", "Assignee", 110],
	["icon-[solar--calendar-linear]", "Due date", 56],
	["icon-[solar--calendar-add-linear]", "Start date", 56],
	["icon-[solar--folder-linear]", "Project", 100],
	["icon-[solar--tag-linear]", "Labels", 80],
	["icon-[solar--repeat-linear]", "Repeat", 96],
	["icon-[solar--stopwatch-linear]", "Estimate", 40],
	["icon-[solar--routing-2-linear]", "Blocked by", 48],
] as const;

/** The panel's own layout while the task loads: real labels, placeholder values. */
function DrawerSkeleton() {
	const bar = (width: number | string, height = 10) => (
		<span className="sk" style={{ width, height }} />
	);
	return (
		<div aria-busy="true">
			<span className="sr">Loading task…</span>
			{bar("60%", 22)}
			<dl className="kv" style={{ marginTop: 12 }}>
				{SKELETON_PROPS.map(([icon, label, w]) => (
					<Fragment key={label}>
						<dt>
							<span className={cn(icon, "size-3.5")} aria-hidden="true" />
							{label}
						</dt>
						<dd style={{ display: "flex", alignItems: "center" }}>
							{bar(w, 12)}
						</dd>
					</Fragment>
				))}
			</dl>
			<div className="dsec">
				<div className="dsec-h">
					<h3>Description</h3>
				</div>
				<div className="col" style={{ gap: 8 }}>
					{bar("92%")}
					{bar("78%")}
					{bar("54%")}
				</div>
			</div>
			<div className="dsec">
				<div className="dsec-h">
					<h3>Subtasks</h3>
				</div>
				<div className="col" style={{ gap: 10 }}>
					{bar("70%", 12)}
					{bar("50%", 12)}
				</div>
			</div>
			<div className="dsec">
				<div className="dsec-h">
					<h3>Attachments</h3>
				</div>
				{bar("100%", 48)}
			</div>
		</div>
	);
}
