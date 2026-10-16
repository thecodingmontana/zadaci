// Task vocabulary (reference constants.js), mapped onto our task status enum.

/** Board columns in order: our stored status, its label, and the reference colour token. */
export const TASK_STATUSES = [
	{ id: "idea", name: "Backlog", st: "backlog" },
	{ id: "todo", name: "To Do", st: "todo" },
	{ id: "in_progress", name: "In Progress", st: "progress" },
	{ id: "in_review", name: "Review", st: "review" },
	{ id: "completed", name: "Done", st: "done" },
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number]["id"];

export const taskStatus = (id: string) =>
	TASK_STATUSES.find((s) => s.id === id) ?? TASK_STATUSES[0];

/** Done or dropped tasks don't count as open work. */
export const isClosed = (status: string) =>
	status === "completed" || status === "abandoned";
