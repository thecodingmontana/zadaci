import assert from "node:assert/strict";
import { test } from "node:test";
import { ancestors, childrenOf, dropTarget } from "./note-tree";

const n = (id: string, parentId: string | null, sortOrder: number) => ({
	id,
	parentId,
	sortOrder,
});
const notes = [
	n("b", null, 2),
	n("a", null, 1),
	n("a1", "a", 1),
	n("a2", "a", 2),
	n("orphan", "hidden", 1),
];
const get = (id: string) => {
	const note = notes.find((x) => x.id === id);
	assert.ok(note);
	return note;
};

test("groups pages under their parents in order; hidden parents fall to the top", () => {
	const tree = childrenOf(notes);
	assert.deepEqual(
		tree.get(null)?.map((x) => x.id),
		["a", "orphan", "b"],
	);
	assert.deepEqual(
		tree.get("a")?.map((x) => x.id),
		["a1", "a2"],
	);
	assert.deepEqual(
		ancestors(notes, "a2").map((x) => x.id),
		["a"],
	);
});

test("drops land between neighbours, at the end of a page, or at the edges", () => {
	const tree = childrenOf(notes);
	assert.deepEqual(dropTarget(tree, get("a2"), "before"), {
		parentId: "a",
		sortOrder: 1.5,
	});
	assert.deepEqual(dropTarget(tree, get("a1"), "before"), {
		parentId: "a",
		sortOrder: 0,
	});
	assert.deepEqual(dropTarget(tree, get("b"), "inside"), {
		parentId: "b",
		sortOrder: 1,
	});
	assert.deepEqual(dropTarget(tree, get("orphan"), "after"), {
		parentId: null,
		sortOrder: 1.5,
	});
});
