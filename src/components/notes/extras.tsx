import { type EmojiItem, emojis } from "@tiptap/extension-emoji";
import { PluginKey } from "@tiptap/pm/state";
import {
	Extension,
	Node,
	type NodeViewProps,
	NodeViewWrapper,
	ReactNodeViewRenderer,
	useEditorState,
} from "@tiptap/react";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { forwardRef } from "react";
import { cn } from "#/lib/utils";
import { type ListHandle, popup, useListNav } from "./slash-menu";

// Smaller note helpers: ":" to type an emoji, and a table of contents block.

/** Emoji whose shortcode or name starts with the typed text first, then ones that contain it. */
export function findEmojis(query: string, limit = 8) {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	const words = (e: EmojiItem) => [...e.shortcodes, e.name, ...e.tags];
	const usable = emojis.filter((e) => e.emoji);
	const starts = usable.filter((e) => words(e).some((w) => w.startsWith(q)));
	const has = usable.filter(
		(e) => !starts.includes(e) && words(e).some((w) => w.includes(q)),
	);
	return [...starts, ...has].slice(0, limit);
}

type EmojiProps = SuggestionProps<EmojiItem, EmojiItem>;

const EmojiList = forwardRef<ListHandle, EmojiProps>(function EmojiList(
	{ items, command },
	ref,
) {
	const { index, setIndex, list } = useListNav(items, command, ref);
	// nothing matches (or nothing typed yet): stay out of the way
	if (!items.length) return null;
	return (
		<div className="pop slash-menu" role="listbox" aria-label="Emoji">
			<div className="slash-list" ref={list}>
				{items.map((item, i) => (
					<button
						key={item.name}
						type="button"
						role="option"
						aria-selected={i === index}
						data-i={i}
						className={cn("mi", i === index && "hl")}
						onMouseEnter={() => setIndex(i)}
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => command(item)}
					>
						<span className="emoji-opt" aria-hidden="true">
							{item.emoji}
						</span>
						<span className="grow trunc">:{item.shortcodes[0]}:</span>
					</button>
				))}
			</div>
		</div>
	);
});

/** Typing ":" and a few letters suggests emoji; the pick goes in as the emoji itself. */
export const EmojiSuggest = Extension.create({
	name: "emojiSuggest",
	addProseMirrorPlugins() {
		return [
			Suggestion<EmojiItem, EmojiItem>({
				editor: this.editor,
				char: ":",
				pluginKey: new PluginKey("emojiSuggest"),
				allow: ({ editor }) => !editor.isActive("codeBlock"),
				items: ({ query }) => findEmojis(query),
				command: ({ editor, range, props }) => {
					editor
						.chain()
						.focus()
						.insertContentAt(range, props.emoji ?? "")
						.run();
				},
				render: () => popup(EmojiList),
			}),
		];
	},
});

/** A table of contents: the page's headings, kept current, each one a jump to it. */
export const TableOfContents = Node.create({
	name: "toc",
	group: "block",
	atom: true,
	draggable: true,
	parseHTML() {
		return [{ tag: 'div[data-type="toc"]' }];
	},
	renderHTML() {
		return ["div", { "data-type": "toc", class: "note-toc" }];
	},
	addNodeView() {
		return ReactNodeViewRenderer(TocView);
	},
});

function TocView({ editor }: NodeViewProps) {
	const headings = useEditorState({
		editor,
		selector: ({ editor: e }) => {
			const out: { pos: number; level: number; text: string }[] = [];
			e.state.doc.descendants((node, pos) => {
				if (node.type.name !== "heading") return true;
				out.push({ pos, level: node.attrs.level, text: node.textContent });
				return false;
			});
			return out;
		},
	});
	return (
		<NodeViewWrapper className="note-toc" contentEditable={false}>
			<div className="note-toc-title">Contents</div>
			{headings.length ? (
				headings.map((h) => (
					<button
						key={h.pos}
						type="button"
						className="note-toc-item"
						style={{ paddingLeft: 8 + (h.level - 1) * 16 }}
						onClick={() =>
							(
								editor.view.nodeDOM(h.pos) as HTMLElement | null
							)?.scrollIntoView({
								behavior: "smooth",
								block: "start",
							})
						}
					>
						{h.text || "Untitled"}
					</button>
				))
			) : (
				<p className="faint note-toc-empty">
					Add headings to the page and they'll be listed here.
				</p>
			)}
		</NodeViewWrapper>
	);
}
