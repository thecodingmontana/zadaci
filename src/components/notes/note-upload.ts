import type { ApolloClient } from "@apollo/client";
import type { Editor } from "@tiptap/react";
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

/** Uploads a file and puts it in the page at `pos`, as an image or a file block. */
export function addFileToNote(
	editor: Editor,
	upload: (file: File) => Promise<string>,
	file: File,
	pos: number,
) {
	return toast
		.promise(upload(file), {
			loading: `Uploading ${file.name}…`,
			success: `${file.name} added`,
			error: `Couldn't upload ${file.name}`,
		})
		.then((src) => {
			const at = Math.min(pos, editor.state.doc.content.size);
			editor
				.chain()
				.focus()
				.insertContentAt(
					at,
					file.type.startsWith("image/")
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
		.catch(() => {});
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
