import type { Editor } from "@tiptap/react";
import { useEffect, useState } from "react";
import { Modal } from "#/components/q/modal";
import {
	EMBED_PROVIDERS,
	isImageSrc,
	isYoutubeSrc,
	toEmbed,
} from "#/lib/note-embeds";
import { toast } from "#/lib/toast";
import { INSERT_EVENT, type InsertKind } from "./blocks";
import { ImagePicker } from "./image-picker";

// Asks for what a media block shows: an image (upload or link), a YouTube link, or a link
// from an embed provider. The "/" menu opens it.

const COPY: Record<
	InsertKind,
	{ title: string; placeholder: string; hint: string }
> = {
	image: {
		title: "Add an image",
		placeholder: "Paste an image link…",
		hint: "Any https image on the web.",
	},
	youtube: {
		title: "Embed a YouTube video",
		placeholder: "Paste a YouTube link…",
		hint: "Watch, share or Shorts links all work.",
	},
	embed: {
		title: "Embed a link",
		placeholder: "Paste a link…",
		hint: `Works with ${EMBED_PROVIDERS.join(", ")}.`,
	},
};

export function InsertDialog({
	slug,
	noteId,
	editor,
}: {
	slug: string;
	noteId: string;
	editor: Editor;
}) {
	const [kind, setKind] = useState<InsertKind | null>(null);
	const [link, setLink] = useState("");

	useEffect(() => {
		const open = (e: Event) => {
			setKind((e as CustomEvent<InsertKind>).detail);
			setLink("");
		};
		window.addEventListener(INSERT_EVENT, open);
		return () => window.removeEventListener(INSERT_EVENT, open);
	}, []);

	const close = () => setKind(null);
	const insert = (run: () => boolean) => {
		if (run()) close();
	};

	const submitLink = () => {
		const url = link.trim();
		if (kind === "image") {
			if (!isImageSrc(url))
				return toast.error("Paste an https link to an image");
			insert(() => editor.chain().focus().setImage({ src: url }).run());
		} else if (kind === "youtube") {
			if (!isYoutubeSrc(url))
				return toast.error("That isn't a YouTube video link");
			insert(() => editor.chain().focus().setYoutubeVideo({ src: url }).run());
		} else if (kind === "embed") {
			const embed = toEmbed(url);
			if (!embed)
				return toast.error("We can't embed that link", {
					desc: COPY.embed.hint,
				});
			insert(() =>
				editor
					.chain()
					.focus()
					.insertContent({ type: "embed", attrs: embed })
					.run(),
			);
		}
	};

	if (!kind) return null;
	const copy = COPY[kind];

	return (
		<Modal
			open
			onOpenChange={(o) => !o && close()}
			title={copy.title}
			size="sm"
		>
			<div className="modal-b insert-media">
				{kind === "image" ? (
					<ImagePicker
						slug={slug}
						noteId={noteId}
						onPick={(src, alt) =>
							insert(() => editor.chain().focus().setImage({ src, alt }).run())
						}
					/>
				) : (
					<form
						className="insert-link"
						onSubmit={(e) => {
							e.preventDefault();
							submitLink();
						}}
					>
						<input
							className="input"
							placeholder={copy.placeholder}
							value={link}
							// biome-ignore lint/a11y/noAutofocus: the link is the only thing to fill in
							autoFocus
							onChange={(e) => setLink(e.target.value)}
						/>
						<p className="faint">{copy.hint}</p>
						<button
							type="submit"
							className="btn btn-primary"
							disabled={!link.trim()}
						>
							Embed
						</button>
					</form>
				)}
			</div>
		</Modal>
	);
}
