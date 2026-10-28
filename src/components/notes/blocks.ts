import { Extension, mergeAttributes, Node } from "@tiptap/react";
import { isEmbedSrc } from "#/lib/note-embeds";

/** Blocks that can be resized and aligned: images, videos and embeds. */
export const MEDIA_TYPES = ["image", "youtube", "embed"];
/** The narrowest a media block gets, as a share of the page width. */
export const MIN_SIZE = 20;
const ALIGNS = ["center", "right"];

const validSize = (value: unknown) => {
	const n = Math.round(Number(value));
	return n >= MIN_SIZE && n <= 100 ? n : null;
};

/**
 * Width (a share of the page, so a resized image fits a phone too) and alignment for media.
 * Values come from saved pages anyone in the workspace can edit, so only numbers and known
 * words ever reach the style.
 */
export const MediaLayout = Extension.create({
	name: "mediaLayout",
	addGlobalAttributes() {
		return [
			{
				types: MEDIA_TYPES,
				attributes: {
					size: {
						default: null,
						parseHTML: (el) => validSize(el.getAttribute("data-size")),
						renderHTML: (attrs) => {
							const size = validSize(attrs.size);
							return size
								? { "data-size": size, style: `width: ${size}%` }
								: {};
						},
					},
					align: {
						default: null,
						parseHTML: (el) => {
							const align = el.getAttribute("data-align");
							return align && ALIGNS.includes(align) ? align : null;
						},
						renderHTML: (attrs) =>
							ALIGNS.includes(attrs.align) ? { "data-align": attrs.align } : {},
					},
				},
			},
		];
	},
});

// Note blocks Tiptap doesn't ship: a callout (an icon beside a line of text) and an embed
// (an iframe from an allowed provider; see lib/note-embeds).

export const Callout = Node.create({
	name: "callout",
	group: "block",
	content: "inline*",
	defining: true,
	addAttributes() {
		return { icon: { default: "💡" } };
	},
	parseHTML() {
		return [
			{ tag: 'div[data-type="callout"]', contentElement: ".callout-body" },
		];
	},
	renderHTML({ node, HTMLAttributes }) {
		return [
			"div",
			mergeAttributes(HTMLAttributes, {
				"data-type": "callout",
				class: "callout",
			}),
			[
				"span",
				{ class: "callout-icon", contenteditable: "false" },
				node.attrs.icon,
			],
			["div", { class: "callout-body" }, 0],
		];
	},
});

export const Embed = Node.create({
	name: "embed",
	group: "block",
	atom: true,
	draggable: true,
	addAttributes() {
		return { src: { default: null }, provider: { default: null } };
	},
	parseHTML() {
		return [
			{
				tag: 'div[data-type="embed"]',
				getAttrs: (el) => ({
					src: el.querySelector("iframe")?.getAttribute("src") ?? null,
					provider: el.getAttribute("data-provider"),
				}),
			},
		];
	},
	renderHTML({ node, HTMLAttributes }) {
		const { src, provider } = node.attrs;
		// only the layout attributes; src and provider are handled below
		const { src: _src, provider: _provider, ...layout } = HTMLAttributes;
		const box = mergeAttributes(layout, {
			"data-type": "embed",
			"data-provider": provider ?? "",
			class: "note-embed",
		});
		// a stored address we don't allow (edited by hand) shows nothing rather than framing it
		if (!isEmbedSrc(src)) return ["div", box, "This embed can't be shown"];
		return [
			"div",
			box,
			[
				"iframe",
				{
					src,
					title: provider ? `${provider} embed` : "Embed",
					loading: "lazy",
					allowfullscreen: "true",
					allow:
						"autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture",
					referrerpolicy: "strict-origin-when-cross-origin",
				},
			],
		];
	},
});

/** Media blocks ask for a link (or a file) first; the editor listens for this. */
export type InsertKind =
	| "image"
	| "youtube"
	| "embed"
	| "task"
	| "bookmark"
	| "project"
	| "link";
export const INSERT_EVENT = "zadaci:note-insert";
export const requestInsert = (kind: InsertKind) =>
	window.dispatchEvent(new CustomEvent(INSERT_EVENT, { detail: kind }));
