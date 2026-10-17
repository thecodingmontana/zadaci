import { useApolloClient } from "@apollo/client/react";
import { Popover } from "radix-ui";
import { type PointerEvent, type ReactNode, useRef, useState } from "react";
import { sendToCloudinary } from "#/components/tasks/upload";
import { NOTE_COVER_UPLOAD } from "#/graphql/note-operations";
import { COVER_GALLERY, coverBackground, isCoverLink } from "#/lib/note-covers";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// A page's cover, like Notion's: hover for Change cover / Reposition, pick from a gallery of
// colours and gradients, upload an image, or paste an image link.

const MAX_COVER = 10 * 1024 * 1024;

export function NoteCover({
	slug,
	noteId,
	cover,
	coverY,
	editable,
	onChange,
}: {
	slug: string;
	noteId: string;
	cover: string;
	coverY: number;
	editable: boolean;
	onChange: (patch: { cover?: string | null; coverY?: number }) => void;
}) {
	const [moving, setMoving] = useState<number | null>(null);
	const drag = useRef<{ y: number; start: number } | null>(null);
	const box = useRef<HTMLDivElement>(null);
	const isImage = !cover.startsWith("gallery:");

	const onMove = (e: PointerEvent<HTMLDivElement>) => {
		if (!drag.current || !box.current) return;
		// dragging down shows more of the top of the image, like Notion
		const dy = e.clientY - drag.current.y;
		const next = drag.current.start - (dy / box.current.clientHeight) * 100;
		setMoving(Math.round(Math.min(100, Math.max(0, next))));
	};

	return (
		<div
			ref={box}
			className={cn("note-cover", moving !== null && "moving")}
			style={coverBackground(cover, moving ?? coverY) ?? undefined}
			onPointerDown={(e) => {
				// presses on Save/Cancel are clicks, not the start of a drag
				if (moving === null || (e.target as HTMLElement).closest(".cover-acts"))
					return;
				e.currentTarget.setPointerCapture(e.pointerId);
				drag.current = { y: e.clientY, start: moving };
			}}
			onPointerMove={onMove}
			onPointerUp={() => {
				drag.current = null;
			}}
		>
			{moving !== null && (
				<span className="cover-hint">Drag image to reposition</span>
			)}
			{editable && (
				<div className="cover-acts">
					{moving !== null ? (
						<>
							<button
								type="button"
								onClick={() => {
									onChange({ coverY: moving });
									setMoving(null);
								}}
							>
								Save position
							</button>
							<button type="button" onClick={() => setMoving(null)}>
								Cancel
							</button>
						</>
					) : (
						<>
							<CoverPicker
								slug={slug}
								noteId={noteId}
								onPick={(value) => onChange({ cover: value, coverY: 50 })}
								onRemove={() => onChange({ cover: null })}
							>
								<button type="button">Change cover</button>
							</CoverPicker>
							{isImage && (
								<button type="button" onClick={() => setMoving(coverY)}>
									Reposition
								</button>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}

type Tab = "gallery" | "upload" | "link";

/** Gallery, Upload and Link tabs, with Remove, in a popover from its trigger. */
export function CoverPicker({
	slug,
	noteId,
	onPick,
	onRemove,
	children,
}: {
	slug: string;
	noteId: string;
	onPick: (cover: string) => void;
	onRemove?: () => void;
	children: ReactNode;
}) {
	const client = useApolloClient();
	const [open, setOpen] = useState(false);
	const [tab, setTab] = useState<Tab>("gallery");
	const [link, setLink] = useState("");
	const [uploading, setUploading] = useState(false);
	const pick = (value: string) => {
		onPick(value);
		setOpen(false);
	};

	const upload = async (file: File) => {
		if (!file.type.startsWith("image/"))
			return toast.error("Pick an image file");
		if (file.size > MAX_COVER) return toast.error("Covers can be up to 10 MB");
		setUploading(true);
		try {
			const { data } = await client.mutate({
				mutation: NOTE_COVER_UPLOAD,
				variables: { slug, id: noteId },
			});
			if (!data) throw new Error("No upload slot");
			const { secure_url } = await sendToCloudinary(data.noteCoverUpload, file);
			pick(secure_url);
		} catch (error) {
			toast.error("Couldn't upload the cover", {
				desc: (error as Error).message,
			});
		} finally {
			setUploading(false);
		}
	};

	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			<Popover.Trigger asChild>{children}</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content
					className="pop enter cover-pop"
					align="end"
					sideOffset={6}
					style={{ position: "relative" }}
				>
					<div className="cover-tabs" role="tablist">
						{(["gallery", "upload", "link"] as const).map((t) => (
							<button
								key={t}
								type="button"
								role="tab"
								aria-selected={tab === t}
								className={cn(tab === t && "on")}
								onClick={() => setTab(t)}
							>
								{t[0]?.toUpperCase()}
								{t.slice(1)}
							</button>
						))}
						<span className="grow" />
						{onRemove && (
							<button
								type="button"
								onClick={() => {
									onRemove();
									setOpen(false);
								}}
							>
								Remove
							</button>
						)}
					</div>
					{tab === "gallery" && (
						<>
							<div className="mh">Colour & gradient</div>
							<div className="cover-grid">
								{Object.entries(COVER_GALLERY).map(([key, background]) => (
									<button
										key={key}
										type="button"
										aria-label={`${key} cover`}
										style={{ background }}
										onClick={() => pick(`gallery:${key}`)}
									/>
								))}
							</div>
						</>
					)}
					{tab === "upload" && (
						<div className="cover-pane">
							<label
								className={cn("btn btn-secondary", uploading && "is-loading")}
							>
								{uploading ? "Uploading…" : "Upload file"}
								<input
									type="file"
									accept="image/*"
									className="sr"
									disabled={uploading}
									onChange={(e) => {
										const file = e.target.files?.[0];
										e.target.value = "";
										if (file) void upload(file);
									}}
								/>
							</label>
							<p className="faint">
								Images wider than 1500 pixels work best. Up to 10 MB.
							</p>
						</div>
					)}
					{tab === "link" && (
						<form
							className="cover-pane"
							onSubmit={(e) => {
								e.preventDefault();
								const url = link.trim();
								if (!isCoverLink(url))
									return toast.error("Paste an https link to an image");
								pick(url);
								setLink("");
							}}
						>
							<input
								className="input"
								placeholder="Paste an image link…"
								value={link}
								onChange={(e) => setLink(e.target.value)}
							/>
							<button type="submit" className="btn btn-primary btn-sm">
								Submit
							</button>
							<p className="faint">Works with any https image on the web.</p>
						</form>
					)}
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}
