import { useMutation } from "@apollo/client/react";
import { type ReactNode, useEffect, useState } from "react";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "#/components/q/menu";
import {
	type NoteItem,
	TOGGLE_NOTE_FAVORITE,
	UPDATE_NOTE,
} from "#/graphql/note-operations";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// The note's controls in the top bar, like Notion's: when it was edited (a spinner while
// saving), who can see it, a star, and the page menu.

function edited(iso: string, now: number) {
	const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
	if (s < 60) return "Edited just now";
	if (s < 3600) return `Edited ${Math.floor(s / 60)}m ago`;
	if (s < 86400) return `Edited ${Math.floor(s / 3600)}h ago`;
	return `Edited ${new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function NoteActions({
	slug,
	note,
	saving,
	failed,
	isAuthor,
	menu,
}: {
	slug: string;
	note: NoteItem;
	saving: boolean;
	failed: boolean;
	/** only the author can make a page private or shared */
	isAuthor: boolean;
	menu: ReactNode;
}) {
	// "2m ago" moves on by itself
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 30_000);
		return () => clearInterval(id);
	}, []);
	// biome-ignore lint/correctness/useExhaustiveDependencies: a fresh save restarts the clock
	useEffect(() => setNow(Date.now()), [note.updatedAt]);

	const [updateNote] = useMutation(UPDATE_NOTE);
	const [toggleFavorite] = useMutation(TOGGLE_NOTE_FAVORITE, {
		optimisticResponse: { toggleNoteFavorite: !note.isFavorite },
		update: (cache, { data }) =>
			cache.modify({
				id: cache.identify({ __typename: "Note", id: note.id }),
				fields: { isFavorite: () => !!data?.toggleNoteFavorite },
			}),
	});

	const share = (isPrivate: boolean) =>
		toast
			.promise(
				updateNote({
					variables: { slug, id: note.id, patch: { isPrivate } },
					optimisticResponse: { updateNote: { ...note, isPrivate } },
				}),
				{
					loading: isPrivate
						? "Making it private…"
						: "Sharing with the workspace…",
					success: isPrivate
						? "Only you can see this page"
						: "Workspace members can see this page",
					error: "Couldn't change who can see it",
				},
			)
			.catch(() => {});

	return (
		<>
			<span className="note-status faint" aria-live="polite">
				{saving && (
					<>
						<span
							className="icon-[hugeicons--loading-03] size-3.5 animate-spin"
							aria-hidden="true"
						/>
						<span className="sr">Saving</span>
					</>
				)}
				{failed ? "Not saved" : edited(note.updatedAt, now)}
			</span>
			<Menu>
				<MenuTrigger
					className="btn btn-ghost btn-sm"
					disabled={!isAuthor}
					title={isAuthor ? undefined : "Only the author can change this"}
				>
					<span
						className={cn(
							note.isPrivate
								? "icon-[solar--lock-keyhole-minimalistic-linear]"
								: "icon-[solar--users-group-rounded-linear]",
							"size-3.5",
						)}
						aria-hidden="true"
					/>
					{note.isPrivate ? "Private" : "Workspace"}
					{isAuthor && (
						<span
							className="icon-[solar--alt-arrow-down-linear] size-3"
							aria-hidden="true"
						/>
					)}
				</MenuTrigger>
				<MenuContent width={250} align="end">
					<MenuItem
						icon="icon-[solar--users-group-rounded-linear]"
						checked={!note.isPrivate}
						onSelect={() => note.isPrivate && share(false)}
					>
						<span className="grow">
							<span className="block">Workspace</span>
							<span className="block faint" style={{ fontSize: 11.5 }}>
								Members can see and edit it
							</span>
						</span>
					</MenuItem>
					<MenuItem
						icon="icon-[solar--lock-keyhole-minimalistic-linear]"
						checked={note.isPrivate}
						onSelect={() => !note.isPrivate && share(true)}
					>
						<span className="grow">
							<span className="block">Private</span>
							<span className="block faint" style={{ fontSize: 11.5 }}>
								Only you, with the pages inside it
							</span>
						</span>
					</MenuItem>
				</MenuContent>
			</Menu>
			<button
				type="button"
				className={cn("ibtn ibtn-sm", note.isFavorite && "starred")}
				aria-label={
					note.isFavorite ? "Remove from favorites" : "Add to favorites"
				}
				aria-pressed={note.isFavorite}
				data-tip={
					note.isFavorite ? "Remove from favorites" : "Add to favorites"
				}
				onClick={() =>
					toggleFavorite({ variables: { slug, id: note.id } }).catch(
						(error: Error) =>
							toast.error("Couldn't update favorites", { desc: error.message }),
					)
				}
			>
				<span
					className={cn(
						note.isFavorite
							? "icon-[solar--star-bold]"
							: "icon-[solar--star-linear]",
						"size-4",
					)}
					aria-hidden="true"
				/>
			</button>
			{menu}
		</>
	);
}
