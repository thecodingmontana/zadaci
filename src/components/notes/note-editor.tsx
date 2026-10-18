import { CombinedGraphQLErrors } from "@apollo/client";
import { useApolloClient, useMutation } from "@apollo/client/react";
import {
	Details,
	DetailsContent,
	DetailsSummary,
} from "@tiptap/extension-details";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import Youtube from "@tiptap/extension-youtube";
import { Placeholder } from "@tiptap/extensions";
import {
	type Editor,
	EditorContent,
	useEditor,
	useEditorState,
} from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import GlobalDragHandle from "tiptap-extension-global-drag-handle";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuSeparator,
	MenuTrigger,
} from "#/components/q/menu";
import {
	type NoteDetail,
	type NoteItem,
	UPDATE_NOTE,
} from "#/graphql/note-operations";
import { randomGalleryCover } from "#/lib/note-covers";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { Callout, Embed } from "./blocks";
import { CodeBlock } from "./code-block";
import { InsertDialog } from "./insert-dialog";
import { NoteActions } from "./note-actions";
import { NoteCover } from "./note-cover";
import { SLASH_COMMANDS, SlashCommands } from "./slash-menu";

// A note's page: emoji, title and a Tiptap body. Changes save on their own a moment after
// you stop typing; a newer save by someone else is never overwritten.

const SAVE_MS = 800;
const HANDLE_ID = "note-block-handle";
const EMOJI =
	"📄 📝 📌 📎 📚 📘 📗 📕 🗂️ 🗒️ 💡 🎯 🚀 ✅ ⭐ 🔥 🧭 🧪 🛠️ 🎨 📣 📈 💬 🗓️ 🔒 🌱 🏁 🧩 ❤️ 👋".split(
		" ",
	);

type Patch = {
	title?: string;
	icon?: string | null;
	doc?: unknown;
	cover?: string | null;
	coverY?: number;
};
type Status = "saved" | "saving" | "conflict" | "error";

function useAutosave(slug: string, note: NoteDetail) {
	const [updateNote] = useMutation(UPDATE_NOTE);
	const pending = useRef<Patch>({});
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const base = useRef(note.updatedAt);
	const [status, setStatus] = useState<Status>("saved");

	const flush = async () => {
		clearTimeout(timer.current);
		const patch = pending.current;
		if (!Object.keys(patch).length) return;
		pending.current = {};
		setStatus("saving");
		try {
			const { data } = await updateNote({
				variables: { slug, id: note.id, patch, baseUpdatedAt: base.current },
			});
			if (data) base.current = data.updateNote.updatedAt;
			setStatus("saved");
		} catch (error) {
			const conflict =
				CombinedGraphQLErrors.is(error) &&
				error.errors.some((e) => e.extensions?.code === "CONFLICT");
			setStatus(conflict ? "conflict" : "error");
			if (!conflict)
				toast.error("Couldn't save the page", {
					desc: (error as Error).message,
				});
		}
	};
	const queue = (patch: Patch) => {
		pending.current = { ...pending.current, ...patch };
		setStatus("saving");
		clearTimeout(timer.current);
		timer.current = setTimeout(() => void flush(), SAVE_MS);
	};
	// leaving the page saves what's waiting
	// biome-ignore lint/correctness/useExhaustiveDependencies: flush on unmount only
	useEffect(() => () => void flush(), []);
	return { queue, status };
}

/** Puts page actions in the top bar, right of the breadcrumb (the slot is client-only). */
function TopbarSlot({ children }: { children: ReactNode }) {
	const [slot, setSlot] = useState<HTMLElement | null>(null);
	useEffect(() => setSlot(document.getElementById("topbar-page")), []);
	return slot ? createPortal(children, slot) : null;
}

export function NoteEditor({
	slug,
	note,
	live,
	onAdd,
}: {
	slug: string;
	note: NoteDetail;
	/** the sidebar's copy of the page, which follows saves (edited time, privacy, star) */
	live: NoteItem;
	/** adds a page inside this one (from the page menu) */
	onAdd: () => void;
}) {
	const client = useApolloClient();
	const { queue, status } = useAutosave(slug, note);
	const [title, setTitle] = useState(note.title);
	const [icon, setIcon] = useState(note.icon);
	const [cover, setCover] = useState({ value: note.cover, y: note.coverY });
	const editable = note.canEdit && status !== "conflict";

	// the sidebar shows the new title and icon while you type, before the save lands
	const showInSidebar = (fields: { title?: string; icon?: string | null }) =>
		client.cache.modify({
			id: client.cache.identify({ __typename: "Note", id: note.id }),
			fields: Object.fromEntries(
				Object.entries(fields).map(([k, v]) => [k, () => v]),
			),
		});

	const editor = useEditor({
		immediatelyRender: false,
		editable,
		content: (note.doc as object | null) ?? undefined,
		extensions: [
			StarterKit.configure({
				heading: { levels: [1, 2, 3] },
				link: { openOnClick: false, autolink: true },
				// no forced empty line at the end of the page (Notion doesn't keep one)
				trailingNode: false,
				// replaced by the Shiki-highlighted block below
				codeBlock: false,
				dropcursor: { color: "var(--q-accent)", width: 3 },
			}),
			TextAlign.configure({ types: ["heading", "paragraph"] }),
			Highlight,
			TaskList,
			TaskItem.configure({ nested: true }),
			Placeholder.configure({
				placeholder: "Write something, or press / for blocks",
			}),
			SlashCommands,
			CodeBlock,
			Image.configure({ allowBase64: false }),
			Youtube.configure({ nocookie: true, modestBranding: true }),
			TableKit.configure({ table: { resizable: true } }),
			Details.configure({ persist: true }),
			DetailsSummary,
			DetailsContent,
			Callout,
			Embed,
			GlobalDragHandle.configure({
				dragHandleSelector: `#${HANDLE_ID}`,
				// the handle holds + and ⋮⋮, so it sits this far left of the block
				dragHandleWidth: 46,
			}),
		],
		onUpdate: ({ editor }) => queue({ doc: editor.getJSON() }),
	});
	useEffect(() => {
		editor?.setEditable(editable);
	}, [editor, editable]);

	const setIconTo = (value: string | null) => {
		setIcon(value);
		showInSidebar({ icon: value });
		queue({ icon: value });
	};
	const changeCover = (patch: { cover?: string | null; coverY?: number }) => {
		setCover((c) => ({
			value: patch.cover !== undefined ? patch.cover : c.value,
			y: patch.coverY ?? c.y,
		}));
		queue(patch);
	};

	return (
		<>
			{cover.value && (
				<NoteCover
					slug={slug}
					noteId={note.id}
					cover={cover.value}
					coverY={cover.y}
					editable={editable}
					onChange={changeCover}
				/>
			)}
			<div className={cn("note-page", cover.value && "has-cover")}>
				{status === "conflict" && (
					<div className="note-banner" role="alert">
						<span
							className="icon-[solar--danger-triangle-linear] size-4"
							aria-hidden="true"
						/>
						Someone else changed this page. Reload to see their version; your
						last changes weren't saved.
						<button
							type="button"
							className="btn btn-secondary btn-sm"
							onClick={() => window.location.reload()}
						>
							Reload
						</button>
					</div>
				)}
				{icon && (
					<IconMenu icon={icon} onPick={setIconTo} disabled={!editable}>
						<button
							type="button"
							className="note-icon"
							aria-label="Change icon"
						>
							{icon}
						</button>
					</IconMenu>
				)}
				{editable && (!icon || !cover.value) && (
					<div className="note-adds">
						{!icon && (
							<IconMenu icon={icon} onPick={setIconTo}>
								<button type="button">
									<span
										className="icon-[solar--emoji-funny-circle-linear] size-4"
										aria-hidden="true"
									/>
									Add icon
								</button>
							</IconMenu>
						)}
						{!cover.value && (
							<button
								type="button"
								onClick={() =>
									changeCover({ cover: randomGalleryCover(), coverY: 50 })
								}
							>
								<span
									className="icon-[solar--gallery-wide-linear] size-4"
									aria-hidden="true"
								/>
								Add cover
							</button>
						)}
					</div>
				)}
				<TopbarSlot>
					<NoteActions
						slug={slug}
						note={live}
						saving={status === "saving"}
						failed={status === "error"}
						isAuthor={note.isAuthor}
						onAdd={onAdd}
					/>
				</TopbarSlot>
				<textarea
					className="note-title"
					value={title}
					placeholder="Untitled"
					readOnly={!editable}
					rows={1}
					aria-label="Page title"
					onChange={(e) => {
						const value = e.target.value.replace(/\n/g, "");
						setTitle(value);
						showInSidebar({ title: value });
						queue({ title: value });
					}}
					onKeyDown={(e) => {
						// Enter moves into the body, like Notion
						if (e.key === "Enter") {
							e.preventDefault();
							editor?.commands.focus("start");
						}
					}}
					ref={(el) => {
						if (!el) return;
						el.style.height = "auto";
						el.style.height = `${el.scrollHeight}px`;
					}}
				/>
				{editor && editable && <SelectionMenu editor={editor} />}
				{/* rendered before the editor starts: the drag-handle extension looks it up by id */}
				{editable && <BlockHandle editor={editor} />}
				{editor && editable && (
					<InsertDialog slug={slug} noteId={note.id} editor={editor} />
				)}
				{/* the editor starts just after the page renders; hold its place meanwhile */}
				{!editor && (
					<div className="note-body-sk" aria-busy="true">
						<span className="sr">Loading page</span>
						{[94, 100, 82, 0, 68, 90, 56].map((w, i) =>
							w ? (
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder lines
								<span key={i} className="sk" style={{ width: `${w}%` }} />
							) : (
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder lines
								<span key={i} style={{ height: 8 }} />
							),
						)}
					</div>
				)}
				<EditorContent editor={editor} className="note-body" />
			</div>
		</>
	);
}

/** The emoji picker for a page's icon, opened from its trigger. */
function IconMenu({
	icon,
	onPick,
	disabled,
	children,
}: {
	icon: string | null;
	onPick: (icon: string | null) => void;
	disabled?: boolean;
	children: ReactNode;
}) {
	return (
		<Menu>
			<MenuTrigger asChild disabled={disabled}>
				{children}
			</MenuTrigger>
			<MenuContent width={236} align="start">
				<div className="emoji-grid">
					{EMOJI.map((e) => (
						<button key={e} type="button" onClick={() => onPick(e)}>
							{e}
						</button>
					))}
				</div>
				{icon && (
					<button
						type="button"
						className="mi"
						style={{ width: "100%" }}
						onClick={() => onPick(null)}
					>
						Remove icon
					</button>
				)}
			</MenuContent>
		</Menu>
	);
}

/**
 * Notion's block handle: + adds a block below (and opens the / menu), ⋮⋮ drags the block
 * or, on click, opens the block menu. The drag-handle extension finds this element by id,
 * moves it beside the hovered block and starts the drag; every part carries "drag-handle"
 * so moving onto + or ⋮⋮ doesn't count as leaving the editor.
 */
function BlockHandle({ editor }: { editor: Editor | null }) {
	const handle = useRef<HTMLDivElement>(null);
	const block = useRef<{ pos: number; size: number } | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);

	/** The top-level block beside the handle right now. */
	const blockBeside = () => {
		const box = handle.current?.getBoundingClientRect();
		if (!editor || !box) return null;
		const hit = editor.view.posAtCoords({
			left: box.right + 60,
			top: box.top + 12,
		});
		if (!hit) return null;
		const at = hit.inside >= 0 ? hit.inside : hit.pos;
		const $at = editor.state.doc.resolve(at);
		const pos = $at.depth ? $at.before(1) : at;
		const node = editor.state.doc.nodeAt(pos);
		return node ? { pos, size: node.nodeSize } : null;
	};
	const openMenu = () => {
		block.current = blockBeside();
		if (block.current) setMenuOpen(true);
	};
	const at = () => block.current;

	return (
		<div
			ref={handle}
			id={HANDLE_ID}
			className="block-handle drag-handle"
			hidden={!editor}
		>
			<button
				type="button"
				className="ibtn ibtn-xs drag-handle"
				aria-label="Add a block below"
				data-tip="Add a block below"
				draggable={false}
				onClick={() => {
					const b = blockBeside();
					if (!editor || !b) return;
					const end = b.pos + b.size;
					editor
						.chain()
						.insertContentAt(end, { type: "paragraph" })
						.focus(end + 1)
						.insertContent("/")
						.run();
				}}
			>
				<span
					className="icon-[hugeicons--plus-sign] size-4 drag-handle"
					aria-hidden="true"
				/>
			</button>
			{/* biome-ignore lint/a11y/useSemanticElements: some browsers won't start a drag from a <button>; role, tabIndex and keys give it button behaviour */}
			<span
				role="button"
				tabIndex={0}
				className="ibtn ibtn-xs grip drag-handle"
				aria-label="Drag to move, or click for block options"
				data-tip="Drag to move · Click for options"
				onClick={openMenu}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						openMenu();
					}
				}}
			>
				<span
					className="icon-[hugeicons--drag-drop-vertical] size-4 drag-handle"
					aria-hidden="true"
				/>
			</span>
			<Menu open={menuOpen} onOpenChange={setMenuOpen}>
				<MenuTrigger asChild>
					<span className="block-anchor" aria-hidden="true" />
				</MenuTrigger>
				<MenuContent width={220} align="start">
					<div className="mh">Turn into</div>
					{SLASH_COMMANDS.filter((c) => c.title !== "Divider").map((c) => (
						<MenuItem
							key={c.title}
							icon={c.icon}
							onSelect={() => {
								const b = at();
								if (b && editor)
									c.run(
										editor
											.chain()
											.focus()
											.setTextSelection(b.pos + 1),
									).run();
							}}
						>
							{c.title}
						</MenuItem>
					))}
					<MenuSeparator />
					<MenuItem
						icon="icon-[solar--arrow-up-linear]"
						onSelect={() => {
							const b = at();
							if (b && editor) moveBlock(editor, b.pos, -1);
						}}
					>
						Move up
					</MenuItem>
					<MenuItem
						icon="icon-[solar--arrow-down-linear]"
						onSelect={() => {
							const b = at();
							if (b && editor) moveBlock(editor, b.pos, 1);
						}}
					>
						Move down
					</MenuItem>
					<MenuItem
						icon="icon-[solar--copy-linear]"
						onSelect={() => {
							const b = at();
							const node = b && editor?.state.doc.nodeAt(b.pos);
							if (b && node && editor)
								editor.view.dispatch(
									editor.state.tr.insert(b.pos + b.size, node),
								);
						}}
					>
						Duplicate
					</MenuItem>
					<MenuItem
						icon="icon-[solar--trash-bin-trash-linear]"
						danger
						onSelect={() => {
							const b = at();
							if (b && editor)
								editor.view.dispatch(
									editor.state.tr.delete(b.pos, b.pos + b.size),
								);
						}}
					>
						Delete
					</MenuItem>
				</MenuContent>
			</Menu>
		</div>
	);
}

/** Swaps a top-level block with the one above (-1) or below (1). */
export function moveBlock(editor: Editor, pos: number, dir: -1 | 1) {
	const { doc, tr } = editor.state;
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
	editor.view.dispatch(
		tr.replaceWith(from, to, dir < 0 ? [node, other] : [other, node]),
	);
}

/** The toolbar over selected text: style, bold/italic/underline/strike, link, align, highlight. */
function SelectionMenu({ editor }: { editor: Editor }) {
	const [linking, setLinking] = useState(false);
	const [href, setHref] = useState("");
	const on = useEditorState({
		editor,
		selector: ({ editor: e }) => ({
			bold: e.isActive("bold"),
			italic: e.isActive("italic"),
			underline: e.isActive("underline"),
			strike: e.isActive("strike"),
			code: e.isActive("code"),
			highlight: e.isActive("highlight"),
			link: e.isActive("link"),
			h1: e.isActive("heading", { level: 1 }),
			h2: e.isActive("heading", { level: 2 }),
			h3: e.isActive("heading", { level: 3 }),
			center: e.isActive({ textAlign: "center" }),
			right: e.isActive({ textAlign: "right" }),
		}),
	});
	const chain = () => editor.chain().focus();
	const btn = (
		label: string,
		icon: string,
		active: boolean,
		run: () => void,
	) => (
		<button
			type="button"
			className={cn("ibtn ibtn-sm", active && "on")}
			aria-label={label}
			aria-pressed={active}
			data-tip={label}
			onMouseDown={(e) => e.preventDefault()}
			onClick={run}
		>
			<span className={cn(icon, "size-4")} aria-hidden="true" />
		</button>
	);

	return (
		<BubbleMenu
			editor={editor}
			options={{ placement: "top" }}
			className="bmenu"
		>
			{linking ? (
				<form
					className="row"
					style={{ gap: 4 }}
					onSubmit={(e) => {
						e.preventDefault();
						const url = href.trim();
						if (!url) chain().unsetLink().run();
						else if (/^(https?:|mailto:)/i.test(url))
							chain().extendMarkRange("link").setLink({ href: url }).run();
						else
							chain()
								.extendMarkRange("link")
								.setLink({ href: `https://${url}` })
								.run();
						setLinking(false);
					}}
				>
					<input
						className="input input-sm"
						placeholder="Paste a link"
						value={href}
						// biome-ignore lint/a11y/noAutofocus: the link field is the only thing in the menu now
						autoFocus
						onChange={(e) => setHref(e.target.value)}
						onKeyDown={(e) => e.key === "Escape" && setLinking(false)}
					/>
					<button type="submit" className="btn btn-sm btn-primary">
						Link
					</button>
				</form>
			) : (
				<>
					<Menu>
						<MenuTrigger
							className="btn btn-ghost btn-sm"
							onMouseDown={(e) => e.preventDefault()}
						>
							{on.h1
								? "Heading 1"
								: on.h2
									? "Heading 2"
									: on.h3
										? "Heading 3"
										: "Text"}
							<span
								className="icon-[solar--alt-arrow-down-linear] size-3"
								aria-hidden="true"
							/>
						</MenuTrigger>
						<MenuContent width={160} align="start">
							{(
								[
									["Text", () => chain().setParagraph().run()],
									[
										"Heading 1",
										() => chain().toggleHeading({ level: 1 }).run(),
									],
									[
										"Heading 2",
										() => chain().toggleHeading({ level: 2 }).run(),
									],
									[
										"Heading 3",
										() => chain().toggleHeading({ level: 3 }).run(),
									],
									["Bulleted list", () => chain().toggleBulletList().run()],
									["Numbered list", () => chain().toggleOrderedList().run()],
									["To-do list", () => chain().toggleTaskList().run()],
									["Quote", () => chain().toggleBlockquote().run()],
									["Code block", () => chain().toggleCodeBlock().run()],
								] as const
							).map(([label, run]) => (
								<button
									key={label}
									type="button"
									className="mi"
									style={{ width: "100%" }}
									onClick={run}
								>
									{label}
								</button>
							))}
						</MenuContent>
					</Menu>
					<span className="bsep" />
					{btn("Bold", "icon-[solar--text-bold-linear]", on.bold, () =>
						chain().toggleBold().run(),
					)}
					{btn("Italic", "icon-[solar--text-italic-linear]", on.italic, () =>
						chain().toggleItalic().run(),
					)}
					{btn(
						"Underline",
						"icon-[solar--text-underline-linear]",
						on.underline,
						() => chain().toggleUnderline().run(),
					)}
					{btn(
						"Strikethrough",
						"icon-[solar--text-cross-linear]",
						on.strike,
						() => chain().toggleStrike().run(),
					)}
					{btn("Code", "icon-[solar--code-linear]", on.code, () =>
						chain().toggleCode().run(),
					)}
					{btn(
						"Highlight",
						"icon-[solar--pen-new-square-linear]",
						on.highlight,
						() => chain().toggleHighlight().run(),
					)}
					{btn("Link", "icon-[solar--link-linear]", on.link, () => {
						setHref(editor.getAttributes("link").href ?? "");
						setLinking(true);
					})}
					<span className="bsep" />
					{btn(
						"Align left",
						"icon-[solar--align-left-linear]",
						!on.center && !on.right,
						() => chain().setTextAlign("left").run(),
					)}
					{btn(
						"Align center",
						"icon-[solar--align-horizontal-center-linear]",
						on.center,
						() => chain().setTextAlign("center").run(),
					)}
					{btn(
						"Align right",
						"icon-[solar--align-right-linear]",
						on.right,
						() => chain().setTextAlign("right").run(),
					)}
				</>
			)}
		</BubbleMenu>
	);
}
