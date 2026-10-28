import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { type Editor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "#/lib/utils";
import { MEDIA_TYPES, MIN_SIZE } from "./blocks";

// A small toolbar over the block you're on: images, videos and embeds get align, resize
// handles and delete; every block can move up or down. Touch screens have no hover handle to
// drag, so there the toolbar also follows the block you're typing in.

const touchScreen = () =>
	typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;

/** The top-level block the toolbar acts on: the selected one, or on touch screens the one you're typing in. */
function current(editor: Editor) {
	const { selection, doc } = editor.state;
	if (selection instanceof NodeSelection && selection.$from.depth === 0)
		return { pos: selection.from, node: selection.node };
	if (!selection.empty || selection.$from.depth < 1 || !touchScreen())
		return null;
	const pos = selection.$from.before(1);
	const node = doc.nodeAt(pos);
	return node ? { pos, node } : null;
}

/** The element a media block's size and alignment apply to (a video's iframe, not its wrapper). */
function mediaElement(editor: Editor, pos: number) {
	const dom = editor.view.nodeDOM(pos);
	if (!(dom instanceof HTMLElement)) return null;
	return dom.matches("[data-youtube-video]")
		? dom.querySelector<HTMLElement>("iframe")
		: dom;
}

/** Swaps a top-level block with the one above (-1) or below (1), keeping your place in it. */
export function moveBlock(editor: Editor, pos: number, dir: -1 | 1) {
	const { doc, selection } = editor.state;
	let offset = 0;
	let index = -1;
	for (let i = 0; i < doc.childCount; i++) {
		if (offset === pos) index = i;
		offset += doc.child(i).nodeSize;
	}
	const node = doc.maybeChild(index);
	const other = doc.maybeChild(index + dir);
	if (!node || !other) return;
	const from = dir < 0 ? pos - other.nodeSize : pos;
	const to = from + node.nodeSize + other.nodeSize;
	const tr = editor.state.tr.replaceWith(
		from,
		to,
		dir < 0 ? [node, other] : [other, node],
	);
	const moved = dir < 0 ? from : from + other.nodeSize;
	if (selection instanceof NodeSelection && selection.from === pos)
		tr.setSelection(NodeSelection.create(tr.doc, moved));
	else if (selection.from > pos && selection.from < pos + node.nodeSize)
		tr.setSelection(
			TextSelection.create(tr.doc, moved + (selection.from - pos)),
		);
	editor.view.dispatch(tr.scrollIntoView());
}

export function BlockToolbar({ editor }: { editor: Editor }) {
	const block = useEditorState({
		editor,
		selector: ({ editor: e }) => {
			const b = current(e);
			if (!b) return null;
			return {
				pos: b.pos,
				type: b.node.type.name,
				align: (b.node.attrs.align as string | null) ?? null,
				picked: e.state.selection instanceof NodeSelection,
				first: b.pos === 0,
				last: b.pos + b.node.nodeSize === e.state.doc.content.size,
			};
		},
	});
	const media = !!block && MEDIA_TYPES.includes(block.type);
	const button = (
		label: string,
		icon: string,
		onClick: () => void,
		on = false,
	) => (
		<button
			type="button"
			className={cn("ibtn ibtn-sm", on && "on")}
			aria-label={label}
			aria-pressed={on || undefined}
			data-tip={label}
			// keeps the selection on the block while you press
			onMouseDown={(e) => e.preventDefault()}
			onClick={onClick}
		>
			<span className={cn(icon, "size-4")} aria-hidden="true" />
		</button>
	);
	const align = (value: string | null) => {
		if (block)
			editor
				.chain()
				.setNodeSelection(block.pos)
				.updateAttributes(block.type, { align: value })
				.run();
	};

	return (
		<>
			<BubbleMenu
				editor={editor}
				pluginKey="blockToolbar"
				className="bmenu block-bar"
				shouldShow={({ editor: e, view }) =>
					e.isEditable && view.hasFocus() && !!current(e)
				}
				getReferencedVirtualElement={() => {
					const b = current(editor);
					const el =
						b &&
						(MEDIA_TYPES.includes(b.node.type.name)
							? mediaElement(editor, b.pos)
							: editor.view.nodeDOM(b.pos));
					return el instanceof HTMLElement
						? { getBoundingClientRect: () => el.getBoundingClientRect() }
						: null;
				}}
				options={{ placement: "top-end", offset: 6 }}
			>
				{media && (
					<>
						{button(
							"Align left",
							"icon-[solar--align-left-linear]",
							() => align(null),
							!block?.align,
						)}
						{button(
							"Align center",
							"icon-[solar--align-horizontal-center-linear]",
							() => align("center"),
							block?.align === "center",
						)}
						{button(
							"Align right",
							"icon-[solar--align-right-linear]",
							() => align("right"),
							block?.align === "right",
						)}
						<span className="bsep" />
					</>
				)}
				{block &&
					!block.first &&
					button("Move up", "icon-[solar--arrow-up-linear]", () =>
						moveBlock(editor, block.pos, -1),
					)}
				{block &&
					!block.last &&
					button("Move down", "icon-[solar--arrow-down-linear]", () =>
						moveBlock(editor, block.pos, 1),
					)}
				{block?.picked &&
					button("Delete", "icon-[solar--trash-bin-trash-linear]", () =>
						editor.chain().focus().deleteSelection().run(),
					)}
			</BubbleMenu>
			{media && block?.picked && (
				<ResizeHandles
					editor={editor}
					pos={block.pos}
					type={block.type}
					align={block.align}
				/>
			)}
		</>
	);
}

/**
 * Handles on a selected media block's sides: drag to make it narrower or wider. It changes
 * on screen as you drag and is saved once you let go, as a share of the page width.
 */
function ResizeHandles({
	editor,
	pos,
	type,
	align,
}: {
	editor: Editor;
	pos: number;
	type: string;
	align: string | null;
}) {
	const host = editor.view.dom.parentElement;
	const [box, setBox] = useState<{
		top: number;
		left: number;
		right: number;
	} | null>(null);

	// where the handles sit, relative to the page body they're drawn in
	const measure = () => {
		const el = mediaElement(editor, pos);
		if (!el || !host) return setBox(null);
		const r = el.getBoundingClientRect();
		const h = host.getBoundingClientRect();
		setBox({
			top: r.top - h.top + r.height / 2,
			left: r.left - h.left,
			right: r.right - h.left,
		});
	};
	// biome-ignore lint/correctness/useExhaustiveDependencies: measure reads the latest pos; re-run when it changes
	useEffect(() => {
		measure();
		const el = mediaElement(editor, pos);
		const observer = new ResizeObserver(() => measure());
		if (el) observer.observe(el);
		editor.on("update", measure);
		return () => {
			observer.disconnect();
			editor.off("update", measure);
		};
	}, [editor, pos]);

	const start =
		(side: "left" | "right") => (e: ReactPointerEvent<HTMLElement>) => {
			const el = mediaElement(editor, pos);
			const page = editor.view.dom.clientWidth;
			if (!el || !page) return;
			e.preventDefault();
			const handle = e.currentTarget;
			handle.setPointerCapture(e.pointerId);
			const startX = e.clientX;
			const startWidth = el.getBoundingClientRect().width;
			let size = Math.round((startWidth / page) * 100);
			const move = (ev: PointerEvent) => {
				const dx = side === "right" ? ev.clientX - startX : startX - ev.clientX;
				// a centred block grows on both sides at once
				const width = startWidth + (align === "center" ? dx * 2 : dx);
				size = Math.min(
					100,
					Math.max(MIN_SIZE, Math.round((width / page) * 100)),
				);
				el.style.width = `${size}%`;
				measure();
			};
			const end = () => {
				handle.removeEventListener("pointermove", move);
				handle.removeEventListener("pointerup", end);
				handle.removeEventListener("pointercancel", end);
				editor
					.chain()
					.setNodeSelection(pos)
					.updateAttributes(type, { size })
					.run();
			};
			handle.addEventListener("pointermove", move);
			handle.addEventListener("pointerup", end);
			handle.addEventListener("pointercancel", end);
		};

	if (!host || !box) return null;
	return createPortal(
		(["left", "right"] as const).map((side) => (
			<span
				key={side}
				className="media-handle"
				style={{ top: box.top, left: side === "left" ? box.left : box.right }}
				aria-hidden="true"
				onPointerDown={start(side)}
				onMouseDown={(e) => e.preventDefault()}
			/>
		)),
		host,
	);
}
