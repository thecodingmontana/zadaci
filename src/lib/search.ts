/** The words around the first match of `q` in `text`, for search results; null when it isn't there. */
export function snippet(
	text: string | null | undefined,
	q: string,
	around = 60,
) {
	if (!text) return null;
	const flat = text.replace(/\s+/g, " ").trim();
	const at = flat.toLowerCase().indexOf(q.toLowerCase());
	if (at < 0) return null;
	const start = Math.max(0, at - around);
	const end = Math.min(flat.length, at + q.length + around);
	return `${start ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}
