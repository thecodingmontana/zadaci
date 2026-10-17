import { mergeAttributes, Node } from "@tiptap/react";
import { isEmbedSrc } from "#/lib/note-embeds";

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
	renderHTML({ node }) {
		const { src, provider } = node.attrs;
		const box = {
			"data-type": "embed",
			"data-provider": provider ?? "",
			class: "note-embed",
		};
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
export type InsertKind = "image" | "youtube" | "embed";
export const INSERT_EVENT = "zadaci:note-insert";
export const requestInsert = (kind: InsertKind) =>
	window.dispatchEvent(new CustomEvent(INSERT_EVENT, { detail: kind }));
