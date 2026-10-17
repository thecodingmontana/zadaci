import { CombinedGraphQLErrors } from "@apollo/client";
import { useApolloClient, useMutation } from "@apollo/client/react";
import Highlight from "@tiptap/extension-highlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import TextAlign from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extensions";
import {
	type Editor,
	EditorContent,
	useEditor,
	useEditorState,
} from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import { Menu, MenuContent, MenuTrigger } from "#/components/q/menu";
import { type NoteDetail, UPDATE_NOTE } from "#/graphql/note-operations";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// A note's page: emoji, title and a Tiptap body. Changes save on their own a moment after
// you stop typing; a newer save by someone else is never overwritten.

const SAVE_MS = 800;
const EMOJI =
	"📄 📝 📌 📎 📚 📘 📗 📕 🗂️ 🗒️ 💡 🎯 🚀 ✅ ⭐ 🔥 🧭 🧪 🛠️ 🎨 📣 📈 💬 🗓️ 🔒 🌱 🏁 🧩 ❤️ 👋".split(
		" ",
	);

type Patch = { title?: string; icon?: string | null; doc?: unknown };
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

export function NoteEditor({ slug, note }: { slug: string; note: NoteDetail }) {
	const client = useApolloClient();
	const { queue, status } = useAutosave(slug, note);
	const [title, setTitle] = useState(note.title);
	const [icon, setIcon] = useState(note.icon);
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
			}),
			TextAlign.configure({ types: ["heading", "paragraph"] }),
			Highlight,
			TaskList,
			TaskItem.configure({ nested: true }),
			Placeholder.configure({
				placeholder:
					"Write something… use # for a heading, - for a list, [] for a to-do",
			}),
		],
		onUpdate: ({ editor }) => queue({ doc: editor.getJSON() }),
	});
	useEffect(() => {
		editor?.setEditable(editable);
	}, [editor, editable]);

	return (
		<div className="note-page">
			{status === "conflict" && (
				<div className="note-banner" role="alert">
					<span
						className="icon-[solar--danger-triangle-linear] size-4"
						aria-hidden="true"
					/>
					Someone else changed this page. Reload to see their version; your last
					changes weren't saved.
					<button
						type="button"
						className="btn btn-secondary btn-sm"
						onClick={() => window.location.reload()}
					>
						Reload
					</button>
				</div>
			)}
			<div className="note-head">
				<Menu>
					<MenuTrigger
						className={cn("note-icon", !icon && "empty")}
						disabled={!note.canEdit}
						aria-label="Change icon"
					>
						{icon ?? (
							<span
								className="icon-[solar--emoji-funny-circle-linear] size-5"
								aria-hidden="true"
							/>
						)}
					</MenuTrigger>
					<MenuContent width={236} align="start">
						<div className="emoji-grid">
							{EMOJI.map((e) => (
								<button
									key={e}
									type="button"
									onClick={() => {
										setIcon(e);
										showInSidebar({ icon: e });
										queue({ icon: e });
									}}
								>
									{e}
								</button>
							))}
						</div>
						{icon && (
							<button
								type="button"
								className="mi"
								style={{ width: "100%" }}
								onClick={() => {
									setIcon(null);
									showInSidebar({ icon: null });
									queue({ icon: null });
								}}
							>
								Remove icon
							</button>
						)}
					</MenuContent>
				</Menu>
				<span className="note-status faint">
					{status === "saving"
						? "Saving…"
						: status === "saved"
							? "Saved"
							: status === "error"
								? "Not saved"
								: ""}
				</span>
			</div>
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
			<EditorContent editor={editor} className="note-body" />
		</div>
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
