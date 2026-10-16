import assert from "node:assert/strict";
import {
	applyView,
	DEFAULT_VIEW,
	groupTasks,
	isOverdue,
	matchFilter,
	orderBetween,
	type ViewTask,
} from "./view-engine";

const today = new Date("2026-10-16T12:00:00");
const t = (over: Partial<ViewTask>): ViewTask => ({
	id: "t",
	key: "WEB-1",
	name: "Task",
	status: "todo",
	priority: "none",
	assigneeId: null,
	projectId: "p1",
	dueDate: null,
	startDate: null,
	labels: [],
	estimate: null,
	sortOrder: 1,
	createdAt: "2026-10-10T00:00:00Z",
	updatedAt: "2026-10-16T08:00:00",
	...over,
});

const late = t({
	id: "a",
	dueDate: "2026-10-14",
	name: "Late",
	priority: "high",
	sortOrder: 2,
});
const soon = t({
	id: "b",
	dueDate: "2026-10-20",
	name: "Soon",
	labels: ["bug"],
	sortOrder: 1,
});
const doneLate = t({
	id: "c",
	dueDate: "2026-10-01",
	status: "completed",
	sortOrder: 3,
});
const none = t({ id: "d", assigneeId: "m1", sortOrder: 4 });

assert.equal(isOverdue(late, today), true);
assert.equal(
	isOverdue(doneLate, today),
	false,
	"finished tasks are never overdue",
);
assert.equal(
	matchFilter(late, { f: "due", op: "is", v: ["overdue"] }, today),
	true,
);
assert.equal(
	matchFilter(soon, { f: "due", op: "is", v: ["week"] }, today),
	true,
);
assert.equal(
	matchFilter(none, { f: "due", op: "is", v: ["nodate"] }, today),
	true,
);
assert.equal(
	matchFilter(soon, { f: "labels", op: "not", v: ["bug"] }, today),
	false,
);
assert.equal(
	matchFilter(late, { f: "assignee", op: "is", v: ["none"] }, today),
	true,
);
assert.equal(
	matchFilter(late, { f: "updated", op: "is", v: ["1"] }, today),
	true,
);

const all = [late, soon, doneLate, none];
assert.deepEqual(
	applyView(all, DEFAULT_VIEW, {}, today).map((x) => x.id),
	["b", "a", "c", "d"],
	"manual order",
);
assert.deepEqual(
	applyView(
		all,
		{ ...DEFAULT_VIEW, sort: { f: "due", dir: 1 } },
		{},
		today,
	).map((x) => x.id),
	["c", "a", "b", "d"],
	"due first, no date last",
);
assert.deepEqual(
	applyView(all, { ...DEFAULT_VIEW, q: "lat" }, {}, today).map((x) => x.id),
	["a"],
);

const byStatus = groupTasks(all, "status");
assert.equal(byStatus.length, 5, "every status column shows, even empty");
assert.deepEqual(
	byStatus.find((g) => g.key === "completed")?.tasks.map((x) => x.id),
	["c"],
);
const byAssignee = groupTasks(all, "assignee", {
	members: [
		{ id: "m1", name: "Ana" },
		{ id: "m2", name: "Ben" },
	],
});
assert.deepEqual(
	byAssignee.map((g) => g.key),
	["m1", "none"],
	"empty people groups hide",
);
assert.deepEqual(byAssignee[1]?.set, { assigneeId: null });

assert.equal(orderBetween(1, 2), 1.5);
assert.equal(orderBetween(undefined, 1), 0);
assert.equal(orderBetween(4, undefined), 5);
console.log("view engine ok");
