import { useQuery } from "@apollo/client/react";
import { useEffect, useState } from "react";
import { UnsplashPane } from "#/components/notes/image-picker";
import { Modal } from "#/components/q/modal";
import { UNSPLASH_ENABLED } from "#/graphql/note-operations";
import { randomAvatars } from "#/lib/dicebear";
import { cn } from "#/lib/utils";

// Profile and workspace pictures share these: uploading (the server shrinks it with sharp) and
// "Choose avatar" (generated avatars, or a photo from Unsplash).

export const MAX_PICTURE = 5 * 1024 * 1024;
// the server's request limit is a little under 4.5 MB, so bigger photos shrink here first
const SEND_LIMIT = 4 * 1024 * 1024;

/** Makes a big photo small enough to send (the server makes the final 512px WebP). */
async function shrink(file: File): Promise<Blob> {
	if (file.size <= SEND_LIMIT || file.type === "image/gif") return file;
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement("canvas");
	canvas.width = Math.round(bitmap.width * scale);
	canvas.height = Math.round(bitmap.height * scale);
	canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(b) => (b ? resolve(b) : reject(new Error("Couldn't read that image"))),
			"image/jpeg",
			0.9,
		),
	);
}

/** Uploads a profile or workspace picture; resolves with its address. */
export async function uploadPicture(
	file: File,
	kind: "avatar" | "workspace",
	slug?: string,
) {
	if (!file.type.startsWith("image/")) throw new Error("Choose an image file");
	if (file.size > MAX_PICTURE)
		throw new Error("Images must be 5 MB or smaller");
	const small = await shrink(file);
	const form = new FormData();
	form.set("file", new File([small], file.name, { type: small.type }));
	form.set("kind", kind);
	if (slug) form.set("slug", slug);
	const res = await fetch("/api/upload/image", { method: "POST", body: form });
	const body = (await res.json().catch(() => ({}))) as {
		url?: string;
		error?: string;
	};
	if (!res.ok || !body.url) throw new Error(body.error ?? "Upload failed");
	return body.url;
}

/** An Unsplash photo as a square picture, centred on faces when it has them. */
const square = (url: string) =>
	`${url}${url.includes("?") ? "&" : "?"}w=512&h=512&fit=crop&crop=faces`;

/** Choose a generated avatar, or a photo from Unsplash (when the server has a key). */
export function AvatarPicker({
	open,
	onOpenChange,
	onPick,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onPick: (url: string) => Promise<void>;
}) {
	const unsplash = !!useQuery(UNSPLASH_ENABLED).data?.unsplashEnabled;
	const [tab, setTab] = useState<"avatars" | "unsplash">("avatars");
	const [options, setOptions] = useState<{ style: string; url: string }[]>([]);
	const [saving, setSaving] = useState<string | null>(null);
	// a new random set each time the picker opens (client-only, so no hydration mismatch)
	useEffect(() => {
		if (open) setOptions(randomAvatars(12));
	}, [open]);
	const pick = async (url: string) => {
		setSaving(url);
		try {
			await onPick(url);
		} finally {
			setSaving(null);
		}
	};

	return (
		<Modal
			busy={!!saving}
			open={open}
			onOpenChange={onOpenChange}
			title="Choose an avatar"
			sub={
				tab === "avatars"
					? "Random avatars in different styles. Shuffle for more."
					: "Search Unsplash for a photo."
			}
			size={tab === "unsplash" ? "lg" : undefined}
			footer={
				<>
					{tab === "avatars" && (
						<button
							type="button"
							className="btn btn-ghost"
							onClick={() => setOptions(randomAvatars(12))}
						>
							<span
								className="icon-[solar--shuffle-linear] size-3.5"
								aria-hidden="true"
							/>
							Shuffle
						</button>
					)}
					<span className="sp" />
					<button
						type="button"
						className="btn btn-secondary"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</button>
				</>
			}
		>
			<div className="modal-b">
				{unsplash && (
					<div
						className="cover-tabs"
						role="tablist"
						style={{ marginBottom: 12 }}
					>
						{(["avatars", "unsplash"] as const).map((t) => (
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
								{t === "avatars" ? "Avatars" : "Unsplash"}
							</button>
						))}
					</div>
				)}
				{tab === "unsplash" ? (
					<UnsplashPane onPick={(url) => void pick(square(url))} />
				) : (
					<div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6">
						{options.map((o, i) => (
							<button
								key={o.url}
								type="button"
								className={cn(
									"grid aspect-square place-items-center rounded-(--q-r-lg) border border-(--q-border) bg-(--q-surface-2) p-1.5 transition-[border-color,box-shadow] hover:border-(--q-accent) focus-visible:shadow-[0_0_0_3px_var(--q-accent-soft)]",
									saving === o.url && "is-loading",
								)}
								aria-label={`Avatar ${i + 1}, ${o.style.replace(/-/g, " ")} style`}
								disabled={!!saving}
								onClick={() => void pick(o.url)}
							>
								<img
									src={o.url}
									alt=""
									className="size-full rounded-(--q-r)"
									loading="lazy"
								/>
							</button>
						))}
					</div>
				)}
			</div>
		</Modal>
	);
}

/** A picture with a small rose × on its corner to remove it (only when there's one to remove). */
export function RemovablePicture({
	children,
	onRemove,
	label,
}: {
	children: React.ReactNode;
	onRemove?: () => void;
	label: string;
}) {
	return (
		<div className="pic-wrap">
			{children}
			{onRemove && (
				<button
					type="button"
					className="pic-x"
					aria-label={label}
					data-tip={label}
					onClick={onRemove}
				>
					<span
						className="icon-[solar--close-small-linear] size-3.5"
						aria-hidden="true"
					/>
				</button>
			)}
		</div>
	);
}
