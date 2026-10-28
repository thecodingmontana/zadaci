import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Extension, mergeAttributes, Node } from "@tiptap/react";
import { isEmbedSrc } from "#/lib/note-embeds";

/** Blocks that can be resized and aligned: images, videos and embeds. */
export const MEDIA_TYPES = ["image", "youtube", "embed"];
/** The narrowest a media block gets, as a share of the page width. */
export const MIN_SIZE = 20;
export const MAX_CAPTION = 300;
/** Blocks that can have a caption: media, plus uploaded files and audio. */
export const CAPTION_TYPES = [...MEDIA_TYPES, "noteFile"];
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
				},
			},
			{
				types: CAPTION_TYPES,
				attributes: {
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
							if (!CAPTION_TYPES.includes(node.type.name)) return;
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

/** Callout kinds, like other Tiptap editors: each has its own colour (notes.css) and icon. */
export const CALLOUT_VARIANTS = [
	{ id: "info", label: "Info", icon: "icon-[solar--info-circle-bold]" },
	{ id: "tip", label: "Tip", icon: "icon-[solar--lightbulb-bolt-bold]" },
	{ id: "success", label: "Success", icon: "icon-[solar--check-circle-bold]" },
	{
		id: "warning",
		label: "Warning",
		icon: "icon-[solar--danger-triangle-bold]",
	},
	{ id: "danger", label: "Danger", icon: "icon-[solar--danger-circle-bold]" },
	{ id: "note", label: "Note", icon: "icon-[solar--notes-bold]" },
] as const;
/** A saved kind, or Info for anything else (older callouts stored an emoji instead). */
export const calloutVariant = (value: unknown) =>
	CALLOUT_VARIANTS.find((v) => v.id === value) ?? CALLOUT_VARIANTS[0];

export const Callout = Node.create({
	name: "callout",
	group: "block",
	content: "inline*",
	defining: true,
	addAttributes() {
		return {
			variant: {
				default: "info",
				parseHTML: (el) => calloutVariant(el.getAttribute("data-variant")).id,
				renderHTML: (attrs) => ({
					"data-variant": calloutVariant(attrs.variant).id,
				}),
			},
		};
	},
	parseHTML() {
		return [
			{ tag: 'div[data-type="callout"]', contentElement: ".callout-body" },
		];
	},
	renderHTML({ node, HTMLAttributes }) {
		const variant = calloutVariant(node.attrs.variant);
		return [
			"div",
			mergeAttributes(HTMLAttributes, {
				"data-type": "callout",
				class: "callout",
			}),
			[
				"span",
				{
					class: `callout-icon ${variant.icon}`,
					contenteditable: "false",
					"aria-hidden": "true",
				},
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
	renderHTML({ node, HTMLAttributes }) {
		const { src, name, bytes, mime } = node.attrs;
		const safe =
			typeof src === "string" && src.startsWith("https://") ? src : null;
		const label = String(name || "File");
		const audio = String(mime).startsWith("audio/");
		// "Where Is The Love.mp3" shows as the title, with "MP3 · 3.8 MB" under it
		const dot = label.lastIndexOf(".");
		const title = dot > 0 ? label.slice(0, dot) : label;
		const ext =
			dot > 0
				? label
						.slice(dot + 1)
						.toUpperCase()
						.slice(0, 8)
				: "";
		const meta = [ext || (audio ? "Audio" : "File"), fileSize(bytes)]
			.filter(Boolean)
			.join(" · ");
		const box = mergeAttributes(
			{ "data-caption": HTMLAttributes["data-caption"] },
			{
				"data-type": "note-file",
				"data-src": safe ?? "",
				"data-name": label,
				"data-bytes": String(bytes ?? ""),
				"data-mime": String(mime ?? ""),
				"data-kind": audio ? "audio" : "file",
				class: "note-file",
			},
		);
		if (!safe) return ["div", box, "This file can't be shown"];
		const head = (tag: string, attrs: Record<string, string>) => [
			tag,
			{ class: "note-file-head", ...attrs },
			[
				"span",
				{ class: "note-file-icon", "aria-hidden": "true" },
				[
					"span",
					{
						class: `size-[18px] ${audio ? "icon-[solar--music-note-2-bold]" : "icon-[solar--file-text-bold]"}`,
					},
				],
			],
			[
				"span",
				{ class: "note-file-text" },
				["span", { class: "note-file-name", title: label }, title],
				["span", { class: "note-file-meta" }, meta],
			],
		];
		if (audio)
			return [
				"div",
				box,
				head("div", {}),
				["audio", { src: safe, controls: "true", preload: "metadata" }],
			];
		return [
			"div",
			box,
			head("a", {
				href: safe,
				target: "_blank",
				rel: "noopener noreferrer",
			}),
		];
	},
});

/** The Emoji block asks for an emoji at the cursor; the editor listens for this. */
export const EMOJI_EVENT = "zadaci:note-emoji";
export const requestEmoji = () =>
	window.dispatchEvent(new CustomEvent(EMOJI_EVENT));
