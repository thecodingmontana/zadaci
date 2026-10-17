import { useApolloClient } from "@apollo/client/react";
import type { Editor } from "@tiptap/react";
import { useEffect, useState } from "react";
import { Modal } from "#/components/q/modal";
import { sendToCloudinary } from "#/components/tasks/upload";
import { NOTE_COVER_UPLOAD } from "#/graphql/note-operations";
import {
	EMBED_PROVIDERS,
	isImageSrc,
	isYoutubeSrc,
	toEmbed,
} from "#/lib/note-embeds";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { INSERT_EVENT, type InsertKind } from "./blocks";

// Asks for what a media block shows: an image (upload or link), a YouTube link, or a link
// from an embed provider. The "/" menu opens it.

const MAX_IMAGE = 10 * 1024 * 1024;

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
	const client = useApolloClient();
	const [kind, setKind] = useState<InsertKind | null>(null);
	const [link, setLink] = useState("");
	const [tab, setTab] = useState<"upload" | "link">("upload");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		const open = (e: Event) => {
			setKind((e as CustomEvent<InsertKind>).detail);
			setLink("");
			setTab("upload");
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

	const upload = async (file: File) => {
		if (!file.type.startsWith("image/"))
			return toast.error("Pick an image file");
		if (file.size > MAX_IMAGE) return toast.error("Images can be up to 10 MB");
		setBusy(true);
		try {
			// the page's upload slot (its covers and images share a folder)
			const { data } = await client.mutate({
				mutation: NOTE_COVER_UPLOAD,
				variables: { slug, id: noteId },
			});
			if (!data) throw new Error("No upload slot");
			const { secure_url } = await sendToCloudinary(data.noteCoverUpload, file);
			insert(() =>
				editor
					.chain()
					.focus()
					.setImage({ src: secure_url, alt: file.name })
					.run(),
			);
		} catch (error) {
			toast.error("Couldn't upload the image", {
				desc: (error as Error).message,
			});
		} finally {
			setBusy(false);
		}
	};

	if (!kind) return null;
	const copy = COPY[kind];
	const showUpload = kind === "image" && tab === "upload";

	return (
		<Modal
			open
			onOpenChange={(o) => !o && close()}
			title={copy.title}
			size="sm"
			busy={busy}
		>
			<div className="modal-b insert-media">
				{kind === "image" && (
					<div className="cover-tabs" role="tablist">
						{(["upload", "link"] as const).map((t) => (
							<button
								key={t}
								type="button"
								role="tab"
								aria-selected={tab === t}
								className={cn(tab === t && "on")}
								onClick={() => setTab(t)}
							>
								{t === "upload" ? "Upload" : "Link"}
							</button>
						))}
					</div>
				)}
				{showUpload ? (
					<label className={cn("insert-drop", busy && "is-loading")}>
						<span
							className="icon-[hugeicons--image-upload] size-6"
							aria-hidden="true"
						/>
						<b>{busy ? "Uploading…" : "Choose an image"}</b>
						<span className="faint">PNG, JPG, GIF or WebP, up to 10 MB</span>
						<input
							type="file"
							accept="image/*"
							className="sr"
							disabled={busy}
							onChange={(e) => {
								const file = e.target.files?.[0];
								e.target.value = "";
								if (file) void upload(file);
							}}
						/>
					</label>
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
							{kind === "image" ? "Add image" : "Embed"}
						</button>
					</form>
				)}
			</div>
		</Modal>
	);
}
