// Task vocabulary (reference constants.js), mapped onto our task status enum.

/** Board columns in order: our stored status, its label, and the reference colour token. */
export const TASK_STATUSES = [
	{ id: "idea", name: "Backlog", st: "backlog" },
	{ id: "todo", name: "To Do", st: "todo" },
	{ id: "in_progress", name: "In Progress", st: "progress" },
	{ id: "in_review", name: "Review", st: "review" },
	{ id: "completed", name: "Done", st: "done" },
] as const;

export const taskStatus = (id: string) =>
	TASK_STATUSES.find((s) => s.id === id) ?? TASK_STATUSES[0];

/** Done or dropped tasks don't count as open work. */
export const isClosed = (status: string) =>
	status === "completed" || status === "abandoned";

/** Priorities, highest first, with the weight used for sorting (reference PRIOS). */
export const PRIORITIES = [
	{ id: "urgent", name: "Urgent", w: 4 },
	{ id: "high", name: "High", w: 3 },
	{ id: "medium", name: "Medium", w: 2 },
	{ id: "low", name: "Low", w: 1 },
	{ id: "none", name: "No priority", w: 0 },
] as const;
export type Priority = (typeof PRIORITIES)[number]["id"];
export const priority = (id: string) =>
	PRIORITIES.find((p) => p.id === id) ?? PRIORITIES[4];

/** The workspace label set (reference LABELS). */
export const LABELS = [
	{ id: "design", name: "Design", c: "var(--q-violet)" },
	{ id: "frontend", name: "Frontend", c: "var(--q-blue)" },
	{ id: "backend", name: "Backend", c: "var(--q-teal)" },
	{ id: "research", name: "Research", c: "var(--q-amber)" },
	{ id: "content", name: "Content", c: "var(--q-rose)" },
	{ id: "bug", name: "Bug", c: "var(--q-red)" },
	{ id: "qa", name: "QA", c: "var(--q-green)" },
	{ id: "growth", name: "Growth", c: "var(--q-orange)" },
] as const;
export const LABEL_IDS = LABELS.map((l) => l.id) as string[];
export const label = (id: string) => LABELS.find((l) => l.id === id);

/** Repeat options and how many days each moves the next due date (reference RECUR_DAYS). */
export const RECUR_DAYS: Record<string, number> = {
	Daily: 1,
	Weekly: 7,
	"Every 2 weeks": 14,
	Monthly: 30,
};
export const RECURS = Object.keys(RECUR_DAYS);

export const ESTIMATES = [
	"30m",
	"1h",
	"2h",
	"4h",
	"1d",
	"2d",
	"3d",
	"5d",
	"8d",
];

/** A task's short code, e.g. WEB-12. */
export const taskKey = (projectKey: string, number: number) =>
	`${projectKey}-${number}`;
