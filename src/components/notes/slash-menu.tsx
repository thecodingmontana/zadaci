import { computePosition, flip, offset, shift, size } from "@floating-ui/dom";
import { type ChainedCommands, Extension, ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { cn } from "#/lib/utils";
import { requestInsert } from "./blocks";

// Notion-style "/" menu: type / in the body to pick a block, filter by typing, then
// Enter or click. The typed "/query" is removed before the block is applied.

type Command = {
	/** section in the menu; Basic blocks when left out */
	group?: "Media" | "Advanced";
	title: string;
	hint: string;
	icon: string;
	/** the markdown shortcut that does the same, shown on the right */
	keys?: string;
	/** other words people type for it */
	alias?: string;
	run: (chain: ChainedCommands) => ChainedCommands;
};

export const SLASH_COMMANDS: Command[] = [
	{
		title: "Text",
		alias: "paragraph plain",
		hint: "Plain writing",
		icon: "icon-[hugeicons--text]",
		run: (c) => c.setParagraph(),
	},
	{
		title: "Heading 1",
		alias: "h1 title",
		hint: "Big section heading",
		icon: "icon-[hugeicons--heading-01]",
		keys: "#",
		run: (c) => c.setHeading({ level: 1 }),
	},
	{
		title: "Heading 2",
		alias: "h2 subtitle",
		hint: "Medium section heading",
		icon: "icon-[hugeicons--heading-02]",
		keys: "##",
		run: (c) => c.setHeading({ level: 2 }),
	},
	{
		title: "Heading 3",
		alias: "h3",
		hint: "Small section heading",
		icon: "icon-[hugeicons--heading-03]",
		keys: "###",
		run: (c) => c.setHeading({ level: 3 }),
	},
	{
		title: "Bulleted list",
		alias: "bullet ul unordered",
		hint: "A simple list",
		icon: "icon-[hugeicons--left-to-right-list-bullet]",
		keys: "-",
		run: (c) => c.toggleBulletList(),
	},
	{
		title: "Numbered list",
		alias: "ordered ol number",
		hint: "A list with numbers",
		icon: "icon-[hugeicons--left-to-right-list-number]",
		keys: "1.",
		run: (c) => c.toggleOrderedList(),
	},
	{
		title: "To-do list",
		alias: "todo task checkbox check",
		hint: "Track tasks with checkboxes",
		icon: "icon-[hugeicons--checkmark-square-02]",
		keys: "[]",
		run: (c) => c.toggleTaskList(),
	},
	{
		title: "Quote",
		alias: "blockquote",
		hint: "Call out a quote",
		icon: "icon-[hugeicons--quote-down]",
		keys: '"',
		run: (c) => c.toggleBlockquote(),
	},
	{
		title: "Code",
		alias: "codeblock snippet",
		hint: "A block of code",
		icon: "icon-[hugeicons--source-code]",
		keys: "```",
		run: (c) => c.toggleCodeBlock(),
	},
	{
		title: "Divider",
		alias: "line hr separator rule",
		hint: "Separate sections",
		icon: "icon-[hugeicons--solid-line-01]",
		keys: "---",
		run: (c) => c.setHorizontalRule(),
	},
	{
		group: "Media",
		title: "Image",
		alias: "picture photo upload",
		hint: "Upload or link an image",
		icon: "icon-[hugeicons--image-01]",
		run: (c) => {
			requestInsert("image");
			return c;
		},
	},
	{
		group: "Media",
		title: "YouTube",
		alias: "video",
		hint: "Embed a YouTube video",
		icon: "icon-[hugeicons--youtube]",
		run: (c) => {
			requestInsert("youtube");
			return c;
		},
	},
	{
		group: "Media",
		title: "Embed",
		alias: "vimeo loom figma codepen spotify map iframe",
		hint: "Vimeo, Loom, Figma, CodePen, Spotify, Maps",
		icon: "icon-[hugeicons--link-square-02]",
		run: (c) => {
			requestInsert("embed");
			return c;
		},
	},
	{
		group: "Advanced",
		title: "Table",
		alias: "grid rows columns",
		hint: "A simple table",
		icon: "icon-[hugeicons--table-01]",
		run: (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
	},
	{
		group: "Advanced",
		title: "Callout",
		alias: "note tip info warning",
		hint: "Make writing stand out",
		icon: "icon-[hugeicons--bulb]",
		run: (c) => c.setNode("callout"),
	},
	{
		group: "Advanced",
		title: "Toggle list",
		alias: "toggle details collapse accordion",
		hint: "Hide content inside",
		icon: "icon-[hugeicons--arrow-right-01]",
		run: (c) => c.setDetails(),
	},
];

/** Commands whose name starts with the typed text first, then ones that contain it. */
export function filterCommands(query: string) {
	const q = query.trim().toLowerCase();
	if (!q) return SLASH_COMMANDS;
	const starts = SLASH_COMMANDS.filter((c) =>
		c.title.toLowerCase().startsWith(q),
	);
	const has = SLASH_COMMANDS.filter(
		(c) =>
			!starts.includes(c) &&
			`${c.title} ${c.hint} ${c.alias ?? ""}`.toLowerCase().includes(q),
	);
	return [...starts, ...has];
}

type ListHandle = { onKeyDown: (event: KeyboardEvent) => boolean };
type ListProps = SuggestionProps<Command, Command>;

const SlashList = forwardRef<ListHandle, ListProps>(function SlashList(
	{ items, command },
	ref,
) {
	const [index, setIndex] = useState(0);
	const list = useRef<HTMLDivElement>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: back to the top whenever the filter changes
	useEffect(() => setIndex(0), [items]);
	useEffect(() => {
		list.current
			?.querySelector(`[data-i="${index}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, [index]);

	useImperativeHandle(ref, () => ({
		onKeyDown: (event) => {
			if (!items.length) return false;
			if (event.key === "ArrowDown") {
				setIndex((i) => (i + 1) % items.length);
				return true;
			}
			if (event.key === "ArrowUp") {
				setIndex((i) => (i - 1 + items.length) % items.length);
				return true;
			}
			if (event.key === "Enter" || event.key === "Tab") {
				const item = items[index];
				if (item) command(item);
				return true;
			}
			return false;
		},
	}));

	return (
		<div className="pop slash-menu" role="listbox" aria-label="Blocks">
			<div className="slash-list" ref={list}>
				{items.length ? (
					items.map((item, i) => [
						(i === 0 || items[i - 1]?.group !== item.group) && (
							<div key={`h-${item.group ?? "basic"}`} className="mh">
								{item.group ?? "Basic blocks"}
							</div>
						),
						<button
							key={item.title}
							type="button"
							role="option"
							aria-selected={i === index}
							data-i={i}
							data-tip={item.hint}
							className={cn("mi", i === index && "hl")}
							onMouseEnter={() => setIndex(i)}
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => command(item)}
						>
							<span
								className={cn(item.icon, "i size-4 shrink-0")}
								aria-hidden="true"
							/>
							<span className="grow trunc">{item.title}</span>
							{item.keys && (
								<span className="faint slash-keys">{item.keys}</span>
							)}
						</button>,
					])
				) : (
					<div className="faint" style={{ padding: "8px 10px" }}>
						No matching blocks
					</div>
				)}
			</div>
			<div className="slash-foot faint">
				<span className="grow">Close menu</span>
				<span className="slash-keys">esc</span>
			</div>
		</div>
	);
});

/**
 * Sits the menu under the cursor, or above it when there's more room there, and caps its
 * height to the space available. Runs after the menu has drawn, so it knows its own size.
 */
function place(
	el: HTMLElement,
	rect: (() => DOMRect | null) | null | undefined,
) {
	requestAnimationFrame(() => {
		const box = rect?.();
		if (!box) return;
		void computePosition({ getBoundingClientRect: () => box }, el, {
			placement: "bottom-start",
			strategy: "fixed",
			middleware: [
				offset(6),
				flip({ padding: 8 }),
				shift({ padding: 8 }),
				size({
					padding: 8,
					apply: ({ availableHeight }) => {
						el.style.setProperty(
							"--slash-max",
							`${Math.max(160, Math.min(380, availableHeight))}px`,
						);
					},
				}),
			],
		}).then(({ x, y }) =>
			Object.assign(el.style, { left: `${x}px`, top: `${y}px` }),
		);
	});
}

export const SlashCommands = Extension.create({
	name: "slashCommands",
	addProseMirrorPlugins() {
		return [
			Suggestion<Command, Command>({
				editor: this.editor,
				char: "/",
				// not inside code, where "/" is just a character
				allow: ({ editor }) => !editor.isActive("codeBlock"),
				items: ({ query }) => filterCommands(query),
				command: ({ editor, range, props }) => {
					props.run(editor.chain().focus().deleteRange(range)).run();
				},
				render: () => {
					let menu: ReactRenderer<ListHandle, ListProps> | undefined;
					const close = () => {
						menu?.destroy();
						menu?.element.remove();
						menu = undefined;
					};
					return {
						onStart: (props) => {
							menu = new ReactRenderer(SlashList, {
								props,
								editor: props.editor,
							});
							// the wrapper is what gets placed; the menu sits inside it
							Object.assign((menu.element as HTMLElement).style, {
								position: "fixed",
								top: "0",
								left: "0",
								zIndex: "80",
							});
							document.body.appendChild(menu.element);
							place(menu.element as HTMLElement, props.clientRect);
						},
						onUpdate: (props) => {
							if (!menu) return;
							menu.updateProps(props);
							place(menu.element as HTMLElement, props.clientRect);
						},
						onKeyDown: ({ event }) => {
							if (event.key === "Escape" && menu) {
								close();
								return true;
							}
							return menu?.ref?.onKeyDown(event) ?? false;
						},
						onExit: close,
					};
				},
			}),
		];
	},
});
