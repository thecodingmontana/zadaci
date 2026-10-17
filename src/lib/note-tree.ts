// The notes sidebar is a tree built from a flat list (each page knows its parent).

type Node = { id: string; parentId: string | null; sortOrder: number };

/** Children of each page, in order. A page whose parent you can't see shows at the top. */
export function childrenOf<T extends Node>(notes: readonly T[]) {
	const ids = new Set(notes.map((n) => n.id));
	const map = new Map<string | null, T[]>();
	for (const n of notes) {
		const key = n.parentId && ids.has(n.parentId) ? n.parentId : null;
		map.set(key, [...(map.get(key) ?? []), n]);
	}
	for (const list of map.values())
		list.sort((a, b) => a.sortOrder - b.sortOrder);
	return map;
}

/** The pages above one page, top first (for breadcrumbs). */
export function ancestors<T extends Node>(notes: readonly T[], id: string) {
	const byId = new Map(notes.map((n) => [n.id, n]));
	const out: T[] = [];
	let at = byId.get(id)?.parentId;
	while (at && byId.has(at) && out.length < 50) {
		const parent = byId.get(at) as T;
		out.unshift(parent);
		at = parent.parentId;
	}
	return out;
}

export type DropSpot = "before" | "inside" | "after";

/**
 * Where a page dropped on `target` lands: its new parent and a sort order between its
 * new neighbours, so only the moved page changes.
 */
export function dropTarget<T extends Node>(
	tree: Map<string | null, T[]>,
	target: T,
	spot: DropSpot,
) {
	if (spot === "inside") {
		const kids = tree.get(target.id) ?? [];
		return {
			parentId: target.id,
			sortOrder: (kids[kids.length - 1]?.sortOrder ?? 0) + 1,
		};
	}
	const [key, siblings] = [...tree.entries()].find(([, list]) =>
		list.some((s) => s.id === target.id),
	) ?? [null, [target]];
	const i = siblings.findIndex((s) => s.id === target.id);
	const next = siblings[spot === "before" ? i - 1 : i + 1];
	const sortOrder = next
		? (target.sortOrder + next.sortOrder) / 2
		: target.sortOrder + (spot === "before" ? -1 : 1);
	return { parentId: key, sortOrder };
}
