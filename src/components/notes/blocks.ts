import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Extension, mergeAttributes, Node } from "@tiptap/react";
import { isEmbedSrc } from "#/lib/note-embeds";

/** Blocks that can be resized and aligned: images, videos and embeds. */
export const MEDIA_TYPES = ["image", "youtube", "embed"];
/** The narrowest a media block gets, as a share of the page width. */
export const MIN_SIZE = 20;
export const MAX_CAPTION = 300;
const ALIGNS = ["center", "right"];

const validSize = (value: unknown) => {
	const n = Math.round(Number(value));
	return n >= MIN_SIZE && n <= 100 ? n : null;
};

/**
 * Width (a share of the page, so a resized image fits a phone too), alignment and a caption for media.
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
					caption: {
						default: null,
						parseHTML: (el) => el.getAttribute("data-caption"),
						renderHTML: (attrs) =>
							typeof attrs.caption === "string" && attrs.caption
								? { "data-caption": attrs.caption.slice(0, MAX_CAPTION) }
								: {},
					},
				},
			},
		];
	},
	// the caption shows under its block, as wide and aligned as the block (text only, never HTML)
	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("mediaCaptions"),
				props: {
					decorations: (state) => {
						const widgets: Decoration[] = [];
						state.doc.forEach((node, pos) => {
							const { caption, size, align } = node.attrs;
							if (!MEDIA_TYPES.includes(node.type.name)) return;
							if (typeof caption !== "string" || !caption.trim()) return;
							const text = caption.trim().slice(0, MAX_CAPTION);
							widgets.push(
								Decoration.widget(
									pos + node.nodeSize,
									() => {
										const el = document.createElement("div");
										el.className = "media-caption";
										el.contentEditable = "false";
										el.textContent = text;
										const width = validSize(size);
										if (width) el.style.width = `${width}%`;
										if (ALIGNS.includes(align)) el.dataset.align = align;
										return el;
									},
									{ side: -1, key: `${pos}|${text}|${size}|${align}` },
								),
							);
						});
						return DecorationSet.create(state.doc, widgets);
					},
				},
			}),
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

/** The File and Audio blocks ask for a file; the editor listens for this. */
export const FILE_EVENT = "zadaci:note-file";
export const requestFile = (kind: "file" | "audio") =>
	window.dispatchEvent(new CustomEvent(FILE_EVENT, { detail: kind }));

const fileSize = (bytes: unknown) => {
	const n = Number(bytes);
	if (!(n > 0)) return "";
	return n < 1024 * 1024
		? `${Math.max(1, Math.round(n / 1024))} KB`
		: `${(n / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * An uploaded file: audio plays in place, anything else is a card to open or download.
 * Saved pages can be edited by hand, so only an https address is ever linked or played.
 */
export const NoteFile = Node.create({
	name: "noteFile",
	group: "block",
	atom: true,
	draggable: true,
	addAttributes() {
		return {
			src: { default: null, parseHTML: (el) => el.getAttribute("data-src") },
			name: {
				default: "File",
				parseHTML: (el) => el.getAttribute("data-name"),
			},
			bytes: {
				default: null,
				parseHTML: (el) => Number(el.getAttribute("data-bytes")) || null,
			},
			mime: { default: null, parseHTML: (el) => el.getAttribute("data-mime") },
		};
	},
	parseHTML() {
		return [{ tag: 'div[data-type="note-file"]' }];
	},
	renderHTML({ node }) {
		const { src, name, bytes, mime } = node.attrs;
		const safe =
			typeof src === "string" && src.startsWith("https://") ? src : null;
		const label = String(name || "File");
		const box = {
			"data-type": "note-file",
			"data-src": safe ?? "",
			"data-name": label,
			"data-bytes": String(bytes ?? ""),
			"data-mime": String(mime ?? ""),
			class: "note-file",
		};
		if (!safe) return ["div", box, "This file can't be shown"];
		if (String(mime).startsWith("audio/"))
			return [
				"div",
				box,
				["span", { class: "note-file-name" }, label],
				["audio", { src: safe, controls: "true", preload: "metadata" }],
			];
		return [
			"div",
			box,
			[
				"a",
				{
					href: safe,
					target: "_blank",
					rel: "noopener noreferrer",
					class: "note-file-link",
				},
				[
					"span",
					{
						class: "icon-[solar--file-text-linear] size-5 note-file-icon",
						"aria-hidden": "true",
					},
				],
				["span", { class: "note-file-name" }, label],
				["span", { class: "note-file-size" }, fileSize(bytes)],
			],
		];
	},
});
