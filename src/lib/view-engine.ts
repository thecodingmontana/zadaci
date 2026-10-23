import { differenceInCalendarDays, parseISO } from "date-fns";
import { isClosed, PRIORITIES, priority, TASK_STATUSES } from "./tasks";

// Task view engine (reference shell/view-engine.js): filters, search, sort and grouping,
// as pure functions over task rows so every view (list, board, table, calendar, timeline)
// shows the same tasks.

export type ViewTask = {
	id: string;
	key: string;
	name: string;
	status: string;
	priority: string;
	assigneeId: string | null;
	/** everyone assigned; older callers may leave it out */
	assigneeIds?: string[];
	projectId: string;
	dueDate: string | null;
	startDate: string | null;
	labels: string[];
	estimate: string | null;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
};

export type FilterField =
	| "status"
	| "assignee"
	| "priority"
	| "due"
	| "project"
	| "labels"
	| "created"
	| "updated";
export type Filter = { f: FilterField; op: "is" | "not"; v: string[] };
export type SortField =
	| "manual"
	| "title"
	| "due"
	| "start"
	| "priority"
	| "status"
	| "assignee"
	| "created"
	| "updated"
	| "estimate"
	| "project";
export type GroupBy =
	| "status"
	| "priority"
	| "assignee"
	| "project"
	| "due"
	| "none";

export type ViewState = {
	filters: Filter[];
	sort: { f: SortField; dir: 1 | -1 };
	group: GroupBy;
	q: string;
	/** table columns the viewer hid */
	hidden: string[];
	/** table column widths the viewer dragged */
	colW: Record<string, number>;
};

export const DEFAULT_VIEW: ViewState = {
	filters: [],
	sort: { f: "manual", dir: 1 },
	group: "status",
	q: "",
	hidden: ["start", "created", "deps"],
	colW: {},
};

export const DUE_BUCKETS = [
	{ id: "overdue", name: "Overdue" },
	{ id: "today", name: "Today" },
	{ id: "week", name: "Next 7 days" },
	{ id: "later", name: "Later" },
	{ id: "nodate", name: "No due date" },
] as const;

export const AGE_BUCKETS = [
	{ id: "1", name: "Last 24 hours" },
	{ id: "7", name: "Last 7 days" },
	{ id: "30", name: "Last 30 days" },
] as const;

const DAY_MS = 86_400_000;

/** Days from today until a task's due date (negative once passed). */
const dueIn = (day: string, today: Date) =>
	differenceInCalendarDays(parseISO(day), today);

export const isOverdue = (
	t: Pick<ViewTask, "dueDate" | "status">,
	today = new Date(),
) => !!t.dueDate && !isClosed(t.status) && dueIn(t.dueDate, today) < 0;

function dueBucket(t: ViewTask, bucket: string, today: Date) {
	if (bucket === "nodate") return !t.dueDate;
	if (!t.dueDate) return false;
	const n = dueIn(t.dueDate, today);
	if (bucket === "overdue") return isOverdue(t, today);
	if (bucket === "today") return n === 0;
	if (bucket === "week") return n >= 0 && n <= 7;
	return n > 7;
}

export function matchFilter(t: ViewTask, f: Filter, today = new Date()) {
	if (!f.v.length) return true;
	let hit: boolean;
	if (f.f === "labels") hit = f.v.some((v) => t.labels.includes(v));
	else if (f.f === "assignee")
		hit = (t.assigneeIds?.length ? t.assigneeIds : ["none"]).some((a) =>
			f.v.includes(a),
		);
	else if (f.f === "project") hit = f.v.includes(t.projectId);
	else if (f.f === "due") hit = f.v.some((v) => dueBucket(t, v, today));
	else if (f.f === "created" || f.f === "updated") {
		const at = Date.parse(f.f === "created" ? t.createdAt : t.updatedAt);
		hit = f.v.some((v) => today.getTime() - at <= Number(v) * DAY_MS);
	} else hit = f.v.includes(t[f.f]);
	return f.op === "not" ? !hit : hit;
}

type Names = {
	assignee?: (id: string | null) => string;
	project?: (id: string) => string;
};

export function sortTasks<T extends ViewTask>(
	tasks: T[],
	sort: ViewState["sort"],
	names: Names = {},
) {
	const key: Record<SortField, (t: T) => string | number> = {
		manual: (t) => t.sortOrder,
		title: (t) => t.name.toLowerCase(),
		due: (t) => t.dueDate ?? "9999",
		start: (t) => t.startDate ?? "9999",
		priority: (t) => -priority(t.priority).w,
		status: (t) => TASK_STATUSES.findIndex((s) => s.id === t.status),
		assignee: (t) =>
			names.assignee?.(t.assigneeId) ?? (t.assigneeId ? "" : "zzz"),
		created: (t) => -Date.parse(t.createdAt),
		updated: (t) => -Date.parse(t.updatedAt),
		estimate: (t) => t.estimate ?? "zzz",
		project: (t) => names.project?.(t.projectId) ?? t.projectId,
	};
	const by = key[sort.f] ?? key.manual;
	return [...tasks].sort((a, b) => {
		const p = by(a);
		const q = by(b);
		return (p > q ? 1 : p < q ? -1 : 0) * sort.dir;
	});
}

/** Filters, then searches title and key, then sorts (reference applyView). */
export function applyView<T extends ViewTask>(
	tasks: T[],
	view: ViewState,
	names: Names = {},
	today = new Date(),
) {
	const q = view.q.trim().toLowerCase();
	return sortTasks(
		tasks.filter(
			(t) =>
				view.filters.every((f) => matchFilter(t, f, today)) &&
				(!q ||
					t.name.toLowerCase().includes(q) ||
					t.key.toLowerCase().includes(q)),
		),
		view.sort,
		names,
	);
}

export type Group<T> = {
	key: string;
	name: string;
	tasks: T[];
	/** what a task dropped or added into this group gets */
	set: Partial<{
		status: string;
		priority: string;
		assigneeId: string | null;
		projectId: string;
		dueDate: string;
	}>;
	/** starts folded (My Tasks "Completed") */
	collapsed?: boolean;
};

/**
 * Splits tasks into groups (reference groupTasks). Status and priority always show every
 * group so you can drop into an empty one; other groupings hide empty groups.
 */
export function groupTasks<T extends ViewTask>(
	tasks: T[],
	by: GroupBy,
	ctx: {
		members?: { id: string; name: string }[];
		projects?: { id: string; title: string }[];
		today?: Date;
	} = {},
): Group<T>[] {
	if (by === "none") return [{ key: "all", name: "All tasks", tasks, set: {} }];
	let groups: Omit<Group<T>, "tasks">[];
	if (by === "status")
		groups = TASK_STATUSES.map((s) => ({
			key: s.id,
			name: s.name,
			set: { status: s.id },
		}));
	else if (by === "priority")
		groups = PRIORITIES.map((p) => ({
			key: p.id,
			name: p.name,
			set: { priority: p.id },
		}));
	else if (by === "assignee")
		groups = [
			...(ctx.members ?? []).map((m) => ({
				key: m.id,
				name: m.name,
				set: { assigneeId: m.id },
			})),
			{ key: "none", name: "Unassigned", set: { assigneeId: null } },
		];
	else if (by === "project")
		groups = (ctx.projects ?? []).map((p) => ({
			key: p.id,
			name: p.title,
			set: { projectId: p.id },
		}));
	else groups = DUE_BUCKETS.map((b) => ({ key: b.id, name: b.name, set: {} }));
	const today = ctx.today ?? new Date();
	const filled = groups.map((g) => ({
		...g,
		tasks: tasks.filter((t) => {
			if (by === "assignee") return (t.assigneeId ?? "none") === g.key;
			if (by === "due") return dueBucket(t, g.key, today);
			if (by === "project") return t.projectId === g.key;
			return t[by] === g.key;
		}),
	}));
	return by === "status" || by === "priority"
		? filled
		: filled.filter((g) => g.tasks.length);
}

/**
 * Sort order for a task dropped between two neighbours (fractional, so nothing else moves).
 */
export function orderBetween(
	before: number | undefined,
	after: number | undefined,
) {
	if (before === undefined && after === undefined) return 1;
	if (before === undefined) return (after as number) - 1;
	if (after === undefined) return before + 1;
	return (before + after) / 2;
}

/**
 * Where a dragged task lands: its new sort order (from the neighbours it ends up between)
 * and the group values it takes on when it changes group. `overId` is the task it was
 * dropped on, or anything else for "the end of the group".
 */
export function planDrop<T extends Pick<ViewTask, "id" | "sortOrder">>(
	groups: Group<T>[],
	taskId: string,
	fromGroup: string,
	toGroup: string,
	overId: string,
) {
	const target = groups.find((g) => g.key === toGroup);
	const all = groups.flatMap((g) => g.tasks);
	if (!target) return null;
	let ids = target.tasks.map((t) => t.id);
	if (fromGroup === toGroup) {
		const from = ids.indexOf(taskId);
		const to = ids.indexOf(overId);
		if (from < 0 || to < 0 || from === to) return null;
		ids.splice(from, 1);
		ids.splice(to, 0, taskId);
	} else {
		ids = ids.filter((id) => id !== taskId);
		const at = ids.indexOf(overId);
		ids.splice(at < 0 ? ids.length : at, 0, taskId);
	}
	const i = ids.indexOf(taskId);
	const order = (id: string | undefined) =>
		all.find((t) => t.id === id)?.sortOrder;
	return {
		sortOrder: orderBetween(order(ids[i - 1]), order(ids[i + 1])),
		set: fromGroup === toGroup ? {} : target.set,
	};
}
