import { projectColor } from "#/components/projects/bits";
import { AvStack } from "#/components/q/av";
import type { TaskItem } from "#/graphql/operations";
import { LABELS, priority, taskStatus } from "#/lib/tasks";
import { relDay } from "#/lib/time";
import { cn } from "#/lib/utils";
import { isOverdue } from "#/lib/view-engine";
import { Lbl, PrPill, StPill } from "./bits";
import { useTaskView } from "./context";
import {
	AssigneesPick,
	DatePick,
	MultiPick,
	PriorityPick,
	ProjectPick,
	StatusPick,
} from "./pick";

// Editable task cells (reference task-list.js cellStatus, cellAssignee, …): a pill that
// opens its picker, or plain text when the viewer can't edit the task.

function Pill({
	label,
	className,
	children,
	...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
	return (
		<button
			type="button"
			className={cn("pillbtn", className)}
			aria-label={label}
			onClick={(e) => e.stopPropagation()}
			{...rest}
		>
			{children}
		</button>
	);
}

const Static = ({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) => (
	<span className={cn("pillbtn", className)} style={{ cursor: "default" }}>
		{children}
	</span>
);

export function CellStatus({ t }: { t: TaskItem }) {
	const { update, canEdit } = useTaskView();
	const body = <StPill status={t.status} />;
	if (!canEdit(t.projectId)) return <Static>{body}</Static>;
	return (
		<StatusPick value={t.status} onPick={(status) => update(t, { status })}>
			<Pill label={`Status: ${taskStatus(t.status).name}`}>{body}</Pill>
		</StatusPick>
	);
}

export function CellPrio({ t }: { t: TaskItem }) {
	const { update, canEdit } = useTaskView();
	const body = <PrPill p={t.priority} />;
	const cls = t.priority === "none" ? "empty" : undefined;
	if (!canEdit(t.projectId)) return <Static className={cls}>{body}</Static>;
	return (
		<PriorityPick value={t.priority} onPick={(p) => update(t, { priority: p })}>
			<Pill label={`Priority: ${priority(t.priority).name}`} className={cls}>
				{body}
			</Pill>
		</PriorityPick>
	);
}

/** The members behind these ids (unknown ones left out). */
export function useAssignees(ids: string[]) {
	const { member } = useTaskView();
	return ids.flatMap((id) => {
		const m = member(id);
		return m ? [m] : [];
	});
}

/** "Amina", "Amina, Brian" or "Amina +2". */
export const assigneeLabel = (people: { name: string }[]) =>
	!people.length
		? "Unassigned"
		: people.length === 1
			? (people[0]?.name ?? "")
			: people.length === 2
				? `${people[0]?.name}, ${people[1]?.name}`
				: `${people[0]?.name} +${people.length - 1}`;

/** Everyone's avatar side by side, or the grey empty circle. */
export function Faces({
	people,
	max = 3,
}: {
	people: { id: string; name: string; image: string | null }[];
	max?: number;
}) {
	return people.length ? (
		<AvStack people={people} max={max} />
	) : (
		<span
			className="av sm"
			style={{ "--c": "var(--q-gray)" } as React.CSSProperties}
		/>
	);
}

export function CellAssignee({ t }: { t: TaskItem }) {
	const { update, canEdit, members } = useTaskView();
	const people = useAssignees(t.assigneeIds);
	// avatars only: the names show on hover (and to screen readers)
	const names = people.map((p) => p.name).join(", ");
	const body = people.length ? (
		<span className="row" data-tip={names}>
			<Faces people={people} max={5} />
			<span className="sr-only">{names}</span>
		</span>
	) : (
		<>
			<Faces people={people} />
			<span className="trunc">{assigneeLabel(people)}</span>
		</>
	);
	const empty = people.length ? undefined : "empty";
	if (!canEdit(t.projectId)) return <Static className={empty}>{body}</Static>;
	return (
		<AssigneesPick
			value={t.assigneeIds}
			people={members}
			onChange={(ids) => update(t, { assigneeIds: ids })}
		>
			<Pill label="Assignees" className={empty}>
				{body}
			</Pill>
		</AssigneesPick>
	);
}

export function CellDue({
	t,
	field = "dueDate",
}: {
	t: TaskItem;
	field?: "dueDate" | "startDate";
}) {
	const { update, canEdit } = useTaskView();
	const day = t[field];
	const over = field === "dueDate" && isOverdue(t);
	const body = (
		<>
			<span
				className="icon-[solar--calendar-linear] size-[13px]"
				aria-hidden="true"
			/>
			{day ? (
				<span className="num" suppressHydrationWarning>
					{relDay(day)}
				</span>
			) : (
				<span>Set date</span>
			)}
		</>
	);
	const cls = day ? (over ? "over" : undefined) : "empty";
	if (!canEdit(t.projectId)) return <Static className={cls}>{body}</Static>;
	return (
		<DatePick value={day} onPick={(d) => update(t, { [field]: d })}>
			<Pill
				label={field === "dueDate" ? "Due date" : "Start date"}
				className={cls}
			>
				{body}
			</Pill>
		</DatePick>
	);
}

export function CellLabels({ t, wrap }: { t: TaskItem; wrap?: boolean }) {
	const { update, canEdit } = useTaskView();
	const shown = wrap ? t.labels : t.labels.slice(0, 2);
	const body = t.labels.length ? (
		<>
			{shown.map((id) => (
				<Lbl key={id} id={id} />
			))}
			{t.labels.length > shown.length && (
				<span className="faint" style={{ fontSize: 11 }}>
					+{t.labels.length - shown.length}
				</span>
			)}
		</>
	) : (
		<>
			<span
				className="icon-[solar--tag-linear] size-[13px]"
				aria-hidden="true"
			/>
			<span>{wrap ? "Add labels" : "Add"}</span>
		</>
	);
	const style = wrap
		? {
				flexWrap: "wrap" as const,
				height: "auto",
				minHeight: 26,
				padding: "3px 7px",
				gap: 4,
			}
		: { gap: 4, overflow: "hidden" };
	const cls = t.labels.length ? undefined : "empty";
	if (!canEdit(t.projectId))
		return (
			<span
				className={cn("pillbtn", cls)}
				style={{ ...style, cursor: "default" }}
			>
				{body}
			</span>
		);
	return (
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
			<Pill label="Labels" className={cls} style={style}>
				{body}
			</Pill>
		</MultiPick>
	);
}

export function CellProject({ t }: { t: TaskItem }) {
	const { update, canEdit, project, projects } = useTaskView();
	const p = project(t.projectId);
	const body = (
		<>
			<span
				className="pdot"
				style={{ "--c": projectColor(p?.color) } as React.CSSProperties}
			/>
			<span className="trunc">{p?.title ?? "Project"}</span>
		</>
	);
	if (!canEdit(t.projectId) || t.parentId) return <Static>{body}</Static>;
	return (
		<ProjectPick
			value={t.projectId}
			projects={projects.filter(
				(x) => x.status !== "complete" && canEdit(x.id),
			)}
			onPick={(projectId) =>
				projectId !== t.projectId && update(t, { projectId })
			}
		>
			<Pill label="Project">{body}</Pill>
		</ProjectPick>
	);
}
