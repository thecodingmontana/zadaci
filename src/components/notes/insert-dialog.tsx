import { useApolloClient } from "@apollo/client/react";
import type { Editor } from "@tiptap/react";
import { useEffect, useState } from "react";
import { Modal } from "#/components/q/modal";
import { LINK_PREVIEW } from "#/graphql/bookmark-operations";
import { EXPAND_MAP_LINK } from "#/graphql/note-operations";
import {
	EMBED_PROVIDERS,
	isImageSrc,
	isShortMapLink,
	isYoutubeSrc,
	toEmbed,
} from "#/lib/note-embeds";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { INSERT_EVENT, type InsertKind } from "./blocks";
import { ImagePicker } from "./image-picker";
import { ItemPicker } from "./item-picker";

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
	task: {
		title: "Add a task",
		placeholder: "Search tasks or paste a task link…",
		hint: 'People who can\'t see the task get a "No access" card.',
	},
	project: {
		title: "Add a project",
		placeholder: "Search projects or paste a project link…",
		hint: 'People who can\'t see the project get a "No access" card.',
	},
	link: {
		title: "Add a link",
		placeholder: "Paste any web link…",
		hint: "Shows the page's title, site and picture as a card.",
	},
	bookmark: {
		title: "Add a bookmark",
		placeholder: "Search bookmarks or paste their link…",
		hint: "Private bookmarks only show for you.",
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
	const [busy, setBusy] = useState(false);

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

	const submitLink = async () => {
		let url = link.trim();
		if (kind === "link") {
			if (!/^https?:\/\//i.test(url) && !/^[\w-]+(\.[\w-]+)+/.test(url))
				return toast.error("Paste a web link, like https://example.com");
			if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
			setBusy(true);
			const page = await client
				.query({
					query: LINK_PREVIEW,
					variables: { slug, url },
					fetchPolicy: "no-cache",
				})
				.then(({ data }) => data?.linkPreview ?? null)
				.catch(() => null)
				.finally(() => setBusy(false));
			const image = page?.image && isImageSrc(page.image) ? page.image : null;
			return insert(() =>
				editor
					.chain()
					.focus()
					.insertContent({
						type: "linkCard",
						attrs: {
							url: page?.url ?? url,
							title: page?.title?.slice(0, 300) ?? null,
							site: page?.site?.slice(0, 300) ?? null,
							image,
						},
					})
					.run(),
			);
		}
		if (kind === "embed" && isShortMapLink(url)) {
			try {
				const { data } = await client.query({
					query: EXPAND_MAP_LINK,
					variables: { url },
					fetchPolicy: "no-cache",
				});
				url = data?.expandMapLink ?? url;
			} catch (error) {
				return toast.error("Couldn't open that map link", {
					desc: (error as Error).message,
				});
			}
		}
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
				{kind === "task" || kind === "bookmark" || kind === "project" ? (
					<ItemPicker
						slug={slug}
						kind={kind}
						placeholder={copy.placeholder}
						hint={copy.hint}
						onPick={(id) =>
							insert(() =>
								editor
									.chain()
									.focus()
									.insertContent({ type: "itemEmbed", attrs: { kind, id } })
									.run(),
							)
						}
					/>
				) : kind === "image" ? (
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
							className={cn("btn btn-primary", busy && "is-loading")}
							disabled={!link.trim() || busy}
						>
							{kind === "link" ? "Add link" : "Embed"}
						</button>
					</form>
				)}
			</div>
		</Modal>
	);
}
