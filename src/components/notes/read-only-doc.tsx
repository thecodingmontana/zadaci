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
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Callout, Embed, MediaLayout, NoteFile } from "./blocks";
import { CodeBlock } from "./code-block";
import { ItemEmbed, LinkCard } from "./item-embed";

// A page shown read-only (public links): the editor's blocks without editing, the "/" menu
// or drag handles. Task, bookmark and project cards show "No access" to people outside.

export function ReadOnlyDoc({ doc }: { doc: unknown }) {
	const editor = useEditor({
		immediatelyRender: false,
		editable: false,
		content: (doc as object | null) ?? undefined,
		extensions: [
			StarterKit.configure({
				heading: { levels: [1, 2, 3] },
				link: { openOnClick: true },
				codeBlock: false,
			}),
			TextAlign.configure({ types: ["heading", "paragraph"] }),
			Highlight,
			TaskList,
			TaskItem.configure({ nested: true }),
			CodeBlock,
			Image.configure({ allowBase64: false }),
			Youtube.configure({ nocookie: true, modestBranding: true }),
			TableKit,
			Details.configure({ persist: true }),
			DetailsSummary,
			DetailsContent,
			Callout,
			Embed,
			MediaLayout,
			NoteFile,
			ItemEmbed,
			LinkCard,
		],
	});
	return <EditorContent editor={editor} className="note-body" />;
}
