import { useMutation } from "@apollo/client/react";
import { useState } from "react";
import { ConfirmModal } from "#/components/q/confirm";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuLabel,
	MenuSeparator,
	MenuSub,
	MenuSubContent,
	MenuSubTrigger,
	MenuTrigger,
} from "#/components/q/menu";
import {
	ARCHIVE_BOOKMARK,
	type BookmarkCollectionItem,
	type BookmarkItem,
	type BookmarkKind,
	DELETE_BOOKMARK,
	MOVE_BOOKMARK,
	TOGGLE_BOOKMARK_FAVORITE,
} from "#/graphql/bookmark-operations";
import { ago } from "#/lib/time";
import { copy, toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// A saved link as a card (grid) or a row (list), with its "…" menu.

export const KINDS: Record<BookmarkKind, { label: string; icon: string }> = {
	article: { label: "Article", icon: "icon-[solar--notebook-linear]" },
	document: { label: "Document", icon: "icon-[solar--document-text-linear]" },
	video: { label: "Video", icon: "icon-[solar--play-circle-linear]" },
};

export const REFETCH = ["Bookmarks", "BookmarkCollections"];

const openLink = (url: string) =>
	window.open(url, "_blank", "noopener,noreferrer");

type CardProps = {
	slug: string;
	b: BookmarkItem;
	collections: BookmarkCollectionItem[];
	onEdit: (b: BookmarkItem) => void;
};

function Thumb({ b, className }: { b: BookmarkItem; className?: string }) {
	const [broken, setBroken] = useState(false);
	return (
		<span className={cn("bthumb", className)}>
			{b.image && !broken ? (
				<img
					src={b.image}
					alt=""
					loading="lazy"
					decoding="async"
					referrerPolicy="no-referrer"
					onError={() => setBroken(true)}
				/>
			) : (
				<span
					className={cn(KINDS[b.kind]?.icon, "size-6 faint")}
					aria-hidden="true"
				/>
			)}
		</span>
	);
}

function Tags({ tags }: { tags: string[] }) {
	if (!tags.length) return null;
	return (
		<span className="btags trunc">
			{tags.map((t) => (
				<span key={t}>#{t}</span>
			))}
		</span>
	);
}

function TitleLink({ b }: { b: BookmarkItem }) {
	return (
		<a
			href={b.url}
			target="_blank"
			rel="noopener noreferrer"
			className="btitle"
			onClick={(e) => e.stopPropagation()}
		>
			{b.title}
		</a>
	);
}

function Meta({ b }: { b: BookmarkItem }) {
	return (
		<span className="bmeta">
			{b.isFavorite && (
				<span
					className="icon-[solar--star-bold] size-3"
					style={{ color: "var(--q-amber)" }}
					role="img"
					aria-label="Favorite"
				/>
			)}
			{b.isPrivate && (
				<span
					className="icon-[solar--lock-keyhole-linear] size-3"
					role="img"
					aria-label="Private"
				/>
			)}
			{b.archivedAt && (
				<span
					className="icon-[solar--archive-linear] size-3"
					role="img"
					aria-label="Archived"
				/>
			)}
			<span className="trunc">{b.site}</span>
			<span aria-hidden="true">·</span>
			<span suppressHydrationWarning>{ago(b.createdAt)}</span>
		</span>
	);
}

export function BookmarkCard(props: CardProps) {
	const { b } = props;
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: the title link is the keyboard target; the card is a bigger click area
		// biome-ignore lint/a11y/useKeyWithClickEvents: same as above
		<div className="fcard bcard" onClick={() => openLink(b.url)}>
			<Thumb b={b} className="fprev" />
			<div className="fi">
				<Tags tags={b.tags} />
				<TitleLink b={b} />
				{b.description && <span className="bdesc">{b.description}</span>}
				<Meta b={b} />
			</div>
			<BookmarkMenu {...props} className="ibtn ibtn-sm more" />
		</div>
	);
}

export function BookmarkRow(props: CardProps) {
	const { b } = props;
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: the title link is the keyboard target
		// biome-ignore lint/a11y/useKeyWithClickEvents: same as above
		<div className="mini brow" onClick={() => openLink(b.url)}>
			<Thumb b={b} className="sm" />
			<div className="grow" style={{ minWidth: 0 }}>
				<Tags tags={b.tags} />
				<TitleLink b={b} />
				{b.description && (
					<span className="bdesc one hide-m">{b.description}</span>
				)}
			</div>
			<span className="hide-m" style={{ width: 160 }}>
				<Meta b={b} />
			</span>
			<BookmarkMenu {...props} className="ibtn ibtn-sm" />
		</div>
	);
}

function BookmarkMenu({
	slug,
	b,
	collections,
	onEdit,
	className,
}: CardProps & { className: string }) {
	const [deleting, setDeleting] = useState(false);
	const opts = { refetchQueries: REFETCH };
	const [move] = useMutation(MOVE_BOOKMARK, opts);
	const [archive] = useMutation(ARCHIVE_BOOKMARK, opts);
	const [star] = useMutation(TOGGLE_BOOKMARK_FAVORITE, opts);
	const [remove] = useMutation(DELETE_BOOKMARK, opts);
	const targets = collections.filter((c) => c.canEdit);
	const fail = (what: string) => (error: Error) =>
		toast.error(`Couldn't ${what}`, { desc: error.message });

	const toggleIn = (c: BookmarkCollectionItem) => {
		const inIt = b.collectionIds.includes(c.id);
		const collectionIds = inIt
			? b.collectionIds.filter((id) => id !== c.id)
			: [...b.collectionIds, c.id];
		move({ variables: { slug, id: b.id, collectionIds } })
			.then(() =>
				toast.success(inIt ? `Removed from ${c.name}` : `Added to ${c.name}`),
			)
			.catch(fail("move the bookmark"));
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: keeps menu clicks from opening the link
		// biome-ignore lint/a11y/useKeyWithClickEvents: only stops propagation; the trigger handles keys
		<span onClick={(e) => e.stopPropagation()} className="contents">
			<Menu>
				<MenuTrigger
					className={className}
					aria-label={`Options for ${b.title}`}
				>
					<span
						className="icon-[solar--menu-dots-bold] size-3.5"
						aria-hidden="true"
					/>
				</MenuTrigger>
				<MenuContent width={220}>
					<MenuItem
						icon="icon-[solar--square-top-down-linear]"
						onSelect={() => openLink(b.url)}
					>
						Open link
					</MenuItem>
					<MenuItem
						icon="icon-[solar--link-linear]"
						onSelect={() => copy(b.url)}
					>
						Copy link
					</MenuItem>
					{b.canEdit && (
						<MenuItem
							icon="icon-[solar--pen-2-linear]"
							onSelect={() => onEdit(b)}
						>
							Edit
						</MenuItem>
					)}
					{b.canEdit && targets.length > 0 && (
						<MenuSub>
							<MenuSubTrigger icon="icon-[solar--folder-with-files-linear]">
								Move to
							</MenuSubTrigger>
							<MenuSubContent width={220}>
								<MenuLabel>Collections</MenuLabel>
								{targets.map((c) => (
									<MenuItem
										key={c.id}
										icon={c.icon ? undefined : "icon-[solar--folder-linear]"}
										checked={b.collectionIds.includes(c.id)}
										keepOpen
										onSelect={() => toggleIn(c)}
									>
										{c.icon && <span aria-hidden="true">{c.icon}</span>}
										<span className="trunc">{c.name}</span>
									</MenuItem>
								))}
							</MenuSubContent>
						</MenuSub>
					)}
					<MenuItem
						icon={
							b.isFavorite
								? "icon-[solar--star-bold]"
								: "icon-[solar--star-linear]"
						}
						onSelect={() =>
							star({ variables: { slug, id: b.id } }).catch(
								fail("update favorites"),
							)
						}
					>
						{b.isFavorite ? "Remove from favorites" : "Add to favorites"}
					</MenuItem>
					{b.canEdit && (
						<MenuItem
							icon="icon-[solar--archive-linear]"
							onSelect={() =>
								archive({
									variables: { slug, id: b.id, archived: !b.archivedAt },
								})
									.then(() =>
										toast.success(b.archivedAt ? "Restored" : "Archived"),
									)
									.catch(fail("archive the bookmark"))
							}
						>
							{b.archivedAt ? "Restore from archive" : "Archive"}
						</MenuItem>
					)}
					{b.canDelete && (
						<>
							<MenuSeparator />
							<MenuItem
								icon="icon-[solar--trash-bin-trash-linear]"
								danger
								onSelect={() => setDeleting(true)}
							>
								Delete
							</MenuItem>
						</>
					)}
				</MenuContent>
			</Menu>
			<ConfirmModal
				open={deleting}
				onOpenChange={setDeleting}
				title={`Delete “${b.title}”?`}
				body="The bookmark will be removed from every collection."
				ok="Delete"
				danger
				icon="icon-[solar--trash-bin-trash-linear]"
				onConfirm={() =>
					toast.promise(remove({ variables: { slug, id: b.id } }), {
						loading: "Deleting…",
						success: "Bookmark deleted",
						error: "Couldn't delete the bookmark",
					})
				}
			/>
		</span>
	);
}
