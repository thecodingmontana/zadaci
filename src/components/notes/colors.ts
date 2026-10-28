import Highlight from "@tiptap/extension-highlight";
import { Extension } from "@tiptap/react";

// Text and background colours, like Notion's. A page stores the colour's name, never a CSS
// value, so a hand-edited page can't slip styles in; notes.css gives each name a shade that
// reads well in light and dark mode.

export const NOTE_COLORS = [
	"gray",
	"brown",
	"orange",
	"yellow",
	"green",
	"blue",
	"purple",
	"pink",
	"red",
] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

const known = (value: unknown): NoteColor | null =>
	NOTE_COLORS.includes(value as NoteColor) ? (value as NoteColor) : null;

const colorAttribute = {
	default: null,
	parseHTML: (el: HTMLElement) => known(el.getAttribute("data-color")),
	renderHTML: (attrs: { color?: unknown }) => {
		const color = known(attrs.color);
		return color ? { "data-color": color } : {};
	},
};

/** A text colour on the text-style mark (add TextStyle alongside it). */
export const TextColor = Extension.create({
	name: "textColor",
	addGlobalAttributes() {
		return [{ types: ["textStyle"], attributes: { color: colorAttribute } }];
	},
});

/** The highlight mark, with an optional named background colour (yellow-ish when none). */
export const ColorHighlight = Highlight.extend({
	addAttributes() {
		return { color: colorAttribute };
	},
}).configure({ multicolor: true });
