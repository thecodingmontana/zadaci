// A note's body is Tiptap JSON. The server only stores documents built from the blocks and
// marks the editor offers, so a hand-made request can't smuggle in scripts or odd links.

import { isEmbedSrc, isImageSrc, isYoutubeSrc } from "./note-embeds";

export const MAX_DOC_BYTES = 500_000;

const NODES = new Set([
	"doc",
	"paragraph",
	"text",
	"heading",
	"bulletList",
	"orderedList",
	"listItem",
	"taskList",
	"taskItem",
	"blockquote",
	"codeBlock",
	"horizontalRule",
	"hardBreak",
	"image",
	"youtube",
	"embed",
	"callout",
	"table",
	"tableRow",
	"tableHeader",
	"tableCell",
	"details",
	"detailsSummary",
	"detailsContent",
]);
/** blocks that load something from elsewhere, and which addresses they may use */
const SOURCES: Record<string, (src: unknown) => boolean> = {
	image: isImageSrc,
	youtube: isYoutubeSrc,
	embed: isEmbedSrc,
};
const MARKS = new Set([
	"bold",
	"italic",
	"underline",
	"strike",
	"code",
	"highlight",
	"link",
	"comment",
]);
// blocks that end a line in the plain-text copy
const LINES = new Set(["paragraph", "heading", "codeBlock", "hardBreak"]);
const SAFE_LINK = /^(https?:|mailto:)/i;

export type DocNode = {
	type: string;
	text?: string;
	attrs?: Record<string, unknown>;
	marks?: { type: string; attrs?: Record<string, unknown> }[];
	content?: DocNode[];
};

const scalar = (v: unknown) =>
	v === null || ["string", "number", "boolean"].includes(typeof v);

/** Plain attribute values only: scalars, or lists of numbers (table column widths). */
function plain(attrs: unknown): Record<string, unknown> | undefined {
	if (attrs == null) return undefined;
	if (typeof attrs !== "object" || Array.isArray(attrs))
		throw new Error("Bad note content");
	for (const v of Object.values(attrs))
		if (
			!scalar(v) &&
			!(Array.isArray(v) && v.every((x) => typeof x === "number"))
		)
			throw new Error("Bad note content");
	return attrs as Record<string, unknown>;
}

function walk(node: unknown, out: string[], depth: number): DocNode {
	if (depth > 40) throw new Error("The note is nested too deeply");
	if (!node || typeof node !== "object") throw new Error("Bad note content");
	const n = node as DocNode;
	if (!NODES.has(n.type)) throw new Error(`Unsupported block: ${n.type}`);
	if (n.type === "text") {
		if (typeof n.text !== "string") throw new Error("Bad note content");
		out.push(n.text);
	}
	const marks = (n.marks ?? []).map((m) => {
		if (!MARKS.has(m?.type)) throw new Error(`Unsupported style: ${m?.type}`);
		const attrs = plain(m.attrs);
		if (m.type === "link" && !SAFE_LINK.test(String(attrs?.href ?? "")))
			throw new Error("Links must start with http, https or mailto");
		return attrs ? { type: m.type, attrs } : { type: m.type };
	});
	if (n.content !== undefined && !Array.isArray(n.content))
		throw new Error("Bad note content");
	const content = n.content?.map((c) => walk(c, out, depth + 1));
	if (LINES.has(n.type)) out.push("\n");
	const attrs = plain(n.attrs);
	const allowed = SOURCES[n.type];
	if (allowed && !allowed(attrs?.src))
		throw new Error(`That ${n.type} can't be shown in a note`);
	return {
		type: n.type,
		...(n.text !== undefined && { text: n.text }),
		...(attrs && { attrs }),
		...(marks.length > 0 && { marks }),
		...(content && { content }),
	};
}

/** The document rebuilt from allowed parts, plus its plain text. Throws a readable error. */
export function checkDoc(doc: unknown): { doc: DocNode; text: string } {
	if (JSON.stringify(doc ?? null).length > MAX_DOC_BYTES)
		throw new Error("This note is too long to save");
	const out: string[] = [];
	const clean = walk(doc, out, 0);
	if (clean.type !== "doc") throw new Error("Bad note content");
	return {
		doc: clean,
		text: out
			.join("")
			.replace(/\n{3,}/g, "\n\n")
			.trim(),
	};
}
