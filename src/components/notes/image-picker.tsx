import { CombinedGraphQLErrors } from "@apollo/client";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { type ReactNode, useEffect, useState } from "react";
import { sendToCloudinary } from "#/components/tasks/upload";
import {
	NOTE_COVER_UPLOAD,
	UNSPLASH,
	UNSPLASH_PICKED,
	type UnsplashPhoto,
} from "#/graphql/note-operations";
import { isImageSrc } from "#/lib/note-embeds";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// Every image picker in notes (covers, image blocks) offers the same sources: upload a file,
// paste a link, or pick a photo from Unsplash. Covers add their colour gallery in front.

const MAX_IMAGE = 10 * 1024 * 1024;
type Tab = "gallery" | "upload" | "link" | "unsplash";

export function ImagePicker({
	slug,
	noteId,
	onPick,
	gallery,
	onRemove,
}: {
	slug: string;
	noteId: string;
	onPick: (url: string, alt?: string) => void;
	/** a Gallery tab first (covers' colours and gradients) */
	gallery?: ReactNode;
	onRemove?: () => void;
}) {
	const tabs: Tab[] = gallery
		? ["gallery", "upload", "link", "unsplash"]
		: ["upload", "link", "unsplash"];
	const [tab, setTab] = useState<Tab>(tabs[0] ?? "upload");

	return (
		<div className="img-picker">
			<div className="cover-tabs" role="tablist">
				{tabs.map((t) => (
					<button
						key={t}
						type="button"
						role="tab"
						aria-selected={tab === t}
						className={cn(tab === t && "on")}
						onClick={() => setTab(t)}
					>
						{t === "unsplash" && (
							<span
								className="icon-[hugeicons--unsplash] size-3"
								aria-hidden="true"
							/>
						)}
						{t[0]?.toUpperCase()}
						{t.slice(1)}
					</button>
				))}
				<span className="grow" />
				{onRemove && (
					<button type="button" onClick={onRemove}>
						Remove
					</button>
				)}
			</div>
			{tab === "gallery" && gallery}
			{tab === "upload" && (
				<UploadPane slug={slug} noteId={noteId} onPick={onPick} />
			)}
			{tab === "link" && <LinkPane onPick={onPick} />}
			{tab === "unsplash" && <UnsplashPane onPick={onPick} />}
		</div>
	);
}

function UploadPane({
	slug,
	noteId,
	onPick,
}: {
	slug: string;
	noteId: string;
	onPick: (url: string, alt?: string) => void;
}) {
	const client = useApolloClient();
	const [busy, setBusy] = useState(false);

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
			onPick(secure_url, file.name);
		} catch (error) {
			toast.error("Couldn't upload the image", {
				desc: (error as Error).message,
			});
		} finally {
			setBusy(false);
		}
	};

	return (
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
	);
}

function LinkPane({ onPick }: { onPick: (url: string) => void }) {
	const [link, setLink] = useState("");
	return (
		<form
			className="insert-link"
			onSubmit={(e) => {
				e.preventDefault();
				const url = link.trim();
				if (!isImageSrc(url))
					return toast.error("Paste an https link to an image");
				onPick(url);
			}}
		>
			<input
				className="input"
				placeholder="Paste an image link…"
				value={link}
				// biome-ignore lint/a11y/noAutofocus: the link is the only thing to fill in
				autoFocus
				onChange={(e) => setLink(e.target.value)}
			/>
			<p className="faint">Works with any https image on the web.</p>
			<button
				type="submit"
				className="btn btn-primary btn-sm"
				disabled={!link.trim()}
			>
				Use image
			</button>
		</form>
	);
}

function UnsplashPane({
	onPick,
}: {
	onPick: (url: string, alt?: string) => void;
}) {
	const [text, setText] = useState("");
	const [query, setQuery] = useState("");
	const [page, setPage] = useState(1);
	// search a moment after typing stops, not on every key
	useEffect(() => {
		const id = setTimeout(() => {
			setQuery(text.trim());
			setPage(1);
		}, 400);
		return () => clearTimeout(id);
	}, [text]);
	const { data, loading, error } = useQuery(UNSPLASH, {
		variables: { query, page },
	});
	const [picked] = useMutation(UNSPLASH_PICKED);
	const off =
		CombinedGraphQLErrors.is(error) &&
		error.errors.some((e) => e.extensions?.code === "UNSPLASH_OFF");

	const pick = (p: UnsplashPhoto) => {
		// Unsplash counts a download whenever a photo is used
		picked({ variables: { downloadLocation: p.downloadLocation } }).catch(
			() => {},
		);
		onPick(p.url, p.alt ?? `Photo by ${p.author} on Unsplash`);
	};

	if (off)
		return (
			<div className="cover-pane">
				<span
					className="icon-[hugeicons--unsplash] size-5"
					aria-hidden="true"
				/>
				<b>Unsplash isn't set up yet</b>
				<p className="faint" style={{ margin: 0 }}>
					Add an UNSPLASH_ACCESS_KEY to the server's environment to search
					photos.
				</p>
			</div>
		);

	const photos = data?.unsplash.photos ?? [];
	return (
		<div className="unsplash">
			<input
				className="input"
				placeholder="Search Unsplash for photos…"
				value={text}
				// biome-ignore lint/a11y/noAutofocus: searching is the first thing to do here
				autoFocus
				onChange={(e) => setText(e.target.value)}
			/>
			{error && !off && <p className="faint">{error.message}</p>}
			<div className="unsplash-grid">
				{photos.map((p) => (
					<div key={p.id} className="unsplash-item">
						<button
							type="button"
							onClick={() => pick(p)}
							aria-label={p.alt ?? `Photo by ${p.author}`}
						>
							<img src={p.thumb} alt="" loading="lazy" />
						</button>
						<a
							href={p.authorUrl}
							target="_blank"
							rel="noreferrer"
							className="trunc"
						>
							{p.author}
						</a>
					</div>
				))}
				{loading &&
					Array.from({ length: photos.length ? 0 : 8 }, (_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders
						<span key={i} className="sk unsplash-sk" />
					))}
			</div>
			{!loading && query && !photos.length && (
				<p className="faint">No photos found</p>
			)}
			<div className="unsplash-foot">
				<span className="faint">
					Photos from{" "}
					<a
						href="https://unsplash.com/?utm_source=zadaci&utm_medium=referral"
						target="_blank"
						rel="noreferrer"
					>
						Unsplash
					</a>
				</span>
				<span className="row" style={{ gap: 4 }}>
					<button
						type="button"
						className="btn btn-ghost btn-sm"
						disabled={page <= 1 || loading}
						onClick={() => setPage((n) => n - 1)}
					>
						Previous
					</button>
					<button
						type="button"
						className="btn btn-ghost btn-sm"
						disabled={loading || page >= (data?.unsplash.totalPages ?? 1)}
						onClick={() => setPage((n) => n + 1)}
					>
						Next
					</button>
				</span>
			</div>
		</div>
	);
}
