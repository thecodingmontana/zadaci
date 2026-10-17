import { Popover } from "radix-ui";
import { type PointerEvent, type ReactNode, useRef, useState } from "react";
import { COVER_GALLERY, coverBackground } from "#/lib/note-covers";
import { cn } from "#/lib/utils";
import { ImagePicker } from "./image-picker";

// A page's cover, like Notion's: hover for Change cover / Reposition, pick from a gallery of
// colours and gradients, upload an image, paste a link or choose an Unsplash photo.

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

/** The cover's sources: the colour gallery, then upload, link and Unsplash. */
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
	const [open, setOpen] = useState(false);
	const pick = (value: string) => {
		onPick(value);
		setOpen(false);
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
					<ImagePicker
						slug={slug}
						noteId={noteId}
						onPick={(url) => pick(url)}
						onRemove={
							onRemove &&
							(() => {
								onRemove();
								setOpen(false);
							})
						}
						gallery={
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
						}
					/>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}
