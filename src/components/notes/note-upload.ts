import type { ApolloClient } from "@apollo/client";
import type { EditorState } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { type Editor, Extension } from "@tiptap/react";
import { sendToCloudinary } from "#/components/tasks/upload";
import { NOTE_COVER_UPLOAD } from "#/graphql/note-operations";
import { maxUpload } from "#/lib/files";
import { toast } from "#/lib/toast";

// Files that go into a page: pictures become image blocks, anything else a file block (audio
// plays in place). Used by the image picker, paste and drop, and the File and Audio blocks.

const MB = 1024 * 1024;

/** Uploads a file into the page's folder and returns its address. */
export async function uploadToNote(
	client: ApolloClient,
	slug: string,
	noteId: string,
	file: File,
) {
	const max = maxUpload(file.type);
	if (file.size > max)
		throw new Error(
			`${file.name} is over ${max / MB} MB, the limit for this kind of file`,
		);
	const { data } = await client.mutate({
		mutation: NOTE_COVER_UPLOAD,
		variables: { slug, id: noteId, file: !file.type.startsWith("image/") },
	});
	if (!data) throw new Error("No upload slot");
	const { secure_url } = await sendToCloudinary(data.noteCoverUpload, file);
	return secure_url as string;
}

// While a file uploads, a placeholder block holds its place in the page; it moves with edits
// around it, and the uploaded block replaces it (or it just goes, if the upload fails).
const uploads = new PluginKey<DecorationSet>("noteUploads");
type UploadMeta =
	| { add: { id: object; pos: number; image: boolean; name: string } }
	| { remove: object };

export const UploadPlaceholders = Extension.create({
	name: "uploadPlaceholders",
	addProseMirrorPlugins() {
		return [
			new Plugin<DecorationSet>({
				key: uploads,
				state: {
					init: () => DecorationSet.empty,
					apply(tr, set) {
						let next = set.map(tr.mapping, tr.doc);
						const meta = tr.getMeta(uploads) as UploadMeta | undefined;
						if (meta && "add" in meta) {
							const { id, pos, image, name } = meta.add;
							const el = document.createElement("div");
							el.className = `upload-sk ${image ? "image" : "file"}`;
							el.setAttribute("aria-busy", "true");
							// screen readers hear what's loading; on screen it's only the skeleton
							el.setAttribute("aria-label", `Uploading ${name}`);
							el.setAttribute("role", "status");
							// a file card's shape: icon, name and size bars
							if (!image)
								for (const part of ["icon", "name", "size"]) {
									const bar = document.createElement("span");
									bar.className = `upload-sk-${part}`;
									el.append(bar);
								}
							next = next.add(tr.doc, [
								Decoration.widget(pos, el, { id, side: -1 }),
							]);
						} else if (meta && "remove" in meta)
							next = next.remove(
								next.find(
									undefined,
									undefined,
									(spec) => spec.id === meta.remove,
								),
							);
						return next;
					},
				},
				props: { decorations: (state) => uploads.getState(state) },
			}),
		];
	},
});

const placeholderAt = (state: EditorState, id: object) =>
	uploads
		.getState(state)
		?.find(undefined, undefined, (spec) => spec.id === id)[0]?.from ?? null;

/** Where a block can go: between blocks, at the end of the one holding `pos`. */
const blockGap = (state: EditorState, pos: number) => {
	const $pos = state.doc.resolve(Math.min(pos, state.doc.content.size));
	return $pos.depth ? $pos.after(1) : $pos.pos;
};

/** Uploads a file and puts it in the page at `pos`, as an image or a file block. */
export function addFileToNote(
	editor: Editor,
	upload: (file: File) => Promise<string>,
	file: File,
	pos: number,
) {
	const id = {};
	const image = file.type.startsWith("image/");
	editor.view.dispatch(
		editor.state.tr.setMeta(uploads, {
			add: { id, pos: blockGap(editor.state, pos), image, name: file.name },
		}),
	);
	const done = () =>
		editor.isDestroyed ||
		editor.view.dispatch(editor.state.tr.setMeta(uploads, { remove: id }));
	return toast
		.promise(upload(file), {
			loading: `Uploading ${file.name}…`,
			success: `${file.name} added`,
			error: `Couldn't upload ${file.name}`,
		})
		.then((src) => {
			if (editor.isDestroyed) return;
			const at = placeholderAt(editor.state, id);
			done();
			if (at === null) return;
			editor
				.chain()
				.insertContentAt(
					at,
					image
						? { type: "image", attrs: { src, alt: file.name } }
						: {
								type: "noteFile",
								attrs: {
									src,
									name: file.name,
									bytes: file.size,
									mime: file.type,
								},
							},
				)
				.run();
		})
		.catch(done);
}

/** Opens the file chooser (from a slash command, so it counts as the person's click). */
export function chooseFile(accept: string, onFile: (file: File) => void) {
	const input = document.createElement("input");
	input.type = "file";
	input.accept = accept;
	input.onchange = () => {
		const file = input.files?.[0];
		if (file) onFile(file);
	};
	input.click();
}
