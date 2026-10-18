import { useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
	BookmarkCard,
	BookmarkRow,
	KINDS,
} from "#/components/bookmarks/bookmark-card";
import { BookmarkModal } from "#/components/bookmarks/bookmark-modal";
import {
	CollectionIcon,
	CollectionMenu,
	CollectionModal,
} from "#/components/bookmarks/collection-modal";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuLabel,
	MenuSeparator,
	MenuTrigger,
} from "#/components/q/menu";
import { Select } from "#/components/settings/ui";
import { ProjectsSkeleton } from "#/components/shell/page-skeletons";
import {
	BOOKMARK_COLLECTIONS,
	BOOKMARKS,
	type BookmarkItem,
	type BookmarkKind,
} from "#/graphql/bookmark-operations";
import { SHELL } from "#/graphql/operations";
import { reloadOnEnter } from "#/lib/routing";
import { wsTitle } from "#/lib/seo";

// Saved links: every bookmark the viewer can see, narrowed by collection, type, tags,
// favorites and search, in a grid or a list. All filters live in the address.

const SORTS = [
	["newest", "Newest added"],
	["oldest", "Oldest added"],
	["az", "Name (A–Z)"],
	["za", "Name (Z–A)"],
] as const;
const LAYOUTS = [
	["grid", "Grid", "icon-[solar--widget-linear]"],
	["list", "List", "icon-[solar--list-linear]"],
] as const;
const UNSORTED = "unsorted";

export const Route = createFileRoute("/_authed/w/$slug/bookmarks")({
	validateSearch: z.object({
		c: z.string().optional().catch(undefined),
		q: z.string().optional().catch(undefined),
		kind: z.enum(["article", "document", "video"]).optional().catch(undefined),
		tags: z.array(z.string()).optional().catch(undefined),
		fav: z.boolean().optional().catch(undefined),
		archived: z.boolean().optional().catch(undefined),
		sort: z.enum(["newest", "oldest", "az", "za"]).optional().catch(undefined),
		view: z.enum(["grid", "list"]).optional().catch(undefined),
	}),
	shouldReload: reloadOnEnter,
	loader: async ({ context, params }) => {
		const [list] = await Promise.all([
			context.apolloClient.query({
				query: BOOKMARKS,
				variables: { slug: params.slug },
				fetchPolicy: "network-only",
			}),
			context.apolloClient.query({
				query: BOOKMARK_COLLECTIONS,
				variables: { slug: params.slug },
				fetchPolicy: "network-only",
			}),
		]);
		if (!list.data) throw notFound();
	},
	head: ({ matches }) => ({
		meta: [{ title: wsTitle(matches, "Bookmarks") }],
	}),
	pendingComponent: ProjectsSkeleton,
	component: BookmarksPage,
});

function BookmarksPage() {
	const { slug } = Route.useParams();
	const search = Route.useSearch();
	const {
		c,
		q = "",
		kind,
		tags = [],
		fav,
		archived,
		sort = "newest",
		view = "grid",
	} = search;
	const navigate = useNavigate({ from: Route.fullPath });
	const { data } = useSuspenseQuery(BOOKMARKS, { variables: { slug } });
	const { data: cols } = useSuspenseQuery(BOOKMARK_COLLECTIONS, {
		variables: { slug },
	});
	const { data: shell } = useSuspenseQuery(SHELL, { variables: { slug } });
	const [form, setForm] = useState<{ key: number; bookmark?: BookmarkItem }>();
	const [creatingCollection, setCreatingCollection] = useState(false);
	const collections = cols.bookmarkCollections;
	const collection = collections.find((x) => x.id === c);
	const isGuest = shell.workspace?.role === "guest";
	const setSearch = (patch: Partial<typeof search>) =>
		navigate({ search: (s) => ({ ...s, ...patch }), replace: true });

	const inPlace = useMemo(
		() =>
			data.bookmarks.filter(
				(b) =>
					!b.archivedAt === !archived &&
					(!c ||
						(c === UNSORTED
							? !b.collectionIds.length
							: b.collectionIds.includes(c))),
			),
		[data, c, archived],
	);
	// tags in this place, most used first, for the filter
	const allTags = useMemo(() => {
		const counts = new Map<string, number>();
		for (const b of data.bookmarks)
			for (const t of b.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
		return [...counts].sort((a, b) => b[1] - a[1]).map(([t]) => t);
	}, [data]);
	const placeTags = [...new Set(inPlace.flatMap((b) => b.tags))];

	const query = q.trim().toLowerCase();
	const shown = inPlace
		.filter(
			(b) =>
				(!kind || b.kind === kind) &&
				(!fav || b.isFavorite) &&
				(!tags.length || tags.some((t) => b.tags.includes(t))) &&
				(!query ||
					[b.title, b.description, b.url, b.site, ...b.tags].some((v) =>
						v?.toLowerCase().includes(query),
					)),
		)
		.sort((a, b) =>
			sort === "az" || sort === "za"
				? a.title.localeCompare(b.title) * (sort === "az" ? 1 : -1)
				: (a.createdAt < b.createdAt ? -1 : 1) * (sort === "oldest" ? 1 : -1),
		);

	const filtered = !!(kind || fav || tags.length || query);
	const clear = () =>
		setSearch({
			q: undefined,
			kind: undefined,
			tags: undefined,
			fav: undefined,
		});
	const toggleTag = (t: string) => {
		const next = tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t];
		setSearch({ tags: next.length ? next : undefined });
	};
	const cardProps = {
		slug,
		collections,
		onEdit: (bookmark: BookmarkItem) => setForm({ key: Date.now(), bookmark }),
	};
	const canAdd = !isGuest || collections.some((x) => x.canEdit);
	const add = () => setForm({ key: Date.now() });

	const title = collection
		? collection.name
		: c === UNSORTED
			? "Unsorted"
			: "Bookmarks";

	let body: React.ReactNode;
	if (c && c !== UNSORTED && !collection)
		body = (
			<Empty
				icon="icon-[solar--folder-error-linear]"
				title="This collection isn't here"
				text="It was deleted, or it isn't shared with you."
				action={["All bookmarks", () => setSearch({ c: undefined })]}
			/>
		);
	else if (!inPlace.length)
		body = archived ? (
			<Empty
				icon="icon-[solar--archive-linear]"
				title="Nothing archived"
				text="Bookmarks you archive wait here, out of the way."
			/>
		) : (
			<Empty
				icon="icon-[solar--bookmark-linear]"
				title={collection ? "No bookmarks here yet" : "No bookmarks yet"}
				text="Save links to articles, documents and videos so the team can find them again."
				action={canAdd ? ["Add bookmark", add] : undefined}
			/>
		);
	else if (!shown.length)
		body = (
			<Empty
				icon="icon-[solar--magnifer-bug-linear]"
				title="No results found"
				text="No bookmarks match your search or filters."
				action={["Clear filters", clear]}
				secondary
			/>
		);
	else if (view === "list")
		body = (
			<div className="panel" style={{ overflow: "hidden" }}>
				{shown.map((b) => (
					<BookmarkRow key={b.id} b={b} {...cardProps} />
				))}
			</div>
		);
	else
		body = (
			<div className="bgrid">
				{shown.map((b) => (
					<BookmarkCard key={b.id} b={b} {...cardProps} />
				))}
			</div>
		);

	return (
		<div className="page wide">
			<div className="ph">
				<div style={{ minWidth: 0 }}>
					<h1 className="row" style={{ gap: 8 }}>
						{collection && <CollectionIcon c={collection} />}
						<span className="trunc">{title}</span>
						{collection?.isPrivate && (
							<span
								className="icon-[solar--lock-keyhole-linear] size-4 faint"
								role="img"
								aria-label="Private collection"
							/>
						)}
					</h1>
					<p>
						{shown.length} {shown.length === 1 ? "bookmark" : "bookmarks"}
						{archived && " archived"}
					</p>
				</div>
				<div className="acts">
					{collection && (
						<CollectionMenu
							slug={slug}
							collection={collection}
							className="btn btn-secondary"
						/>
					)}
					{canAdd && (
						<button type="button" className="btn btn-primary" onClick={add}>
							<span
								className="icon-[hugeicons--plus-sign] size-3.5"
								aria-hidden="true"
							/>
							Add bookmark
						</button>
					)}
				</div>
			</div>

			<div
				className="row"
				style={{ marginBottom: 10, flexWrap: "wrap", gap: 8 }}
			>
				<div className="inwrap">
					<span
						className="i icon-[solar--magnifer-linear] size-[13px]"
						aria-hidden="true"
					/>
					<input
						className="input search-sm"
						placeholder="Search bookmarks"
						aria-label="Search bookmarks"
						value={q}
						onChange={(e) => setSearch({ q: e.target.value || undefined })}
					/>
				</div>
				<Select
					label="Collection"
					value={c ?? ""}
					options={[
						["", "All bookmarks"],
						...(isGuest ? [] : [[UNSORTED, "Unsorted"] as const]),
						...collections.map(
							(x) => [x.id, `${x.icon ? `${x.icon} ` : ""}${x.name}`] as const,
						),
					]}
					onChange={(v) => setSearch({ c: v || undefined })}
					className="h-[26px] w-auto min-w-0 text-xs"
				/>
				<FilterMenu
					kind={kind}
					fav={!!fav}
					archived={!!archived}
					tags={tags}
					placeTags={placeTags}
					setSearch={setSearch}
					toggleTag={toggleTag}
				/>
				<Select
					label="Sort"
					value={sort}
					options={SORTS}
					onChange={(v) =>
						setSearch({
							sort: v === "newest" ? undefined : (v as typeof sort),
						})
					}
					className="h-[26px] w-auto min-w-0 text-xs"
				/>
				<span className="sp" />
				<button
					type="button"
					className="btn btn-ghost btn-sm hide-m"
					onClick={() => setCreatingCollection(true)}
					disabled={isGuest && !shell.workspace?.projects.length}
				>
					<span
						className="icon-[hugeicons--folder-add] size-3.5"
						aria-hidden="true"
					/>
					New collection
				</button>
				<div className="seg" role="tablist" aria-label="Layout">
					{LAYOUTS.map(([k, n, icon]) => (
						<button
							key={k}
							type="button"
							role="tab"
							aria-selected={view === k}
							aria-label={n}
							className={view === k ? "on" : ""}
							onClick={() => setSearch({ view: k === "grid" ? undefined : k })}
						>
							<span className={`${icon} size-[13px]`} aria-hidden="true" />
							<span className="hide-m">{n}</span>
						</button>
					))}
				</div>
			</div>

			{(filtered || archived) && (
				<div
					className="row"
					style={{ marginBottom: 14, flexWrap: "wrap", gap: 6 }}
				>
					{archived && (
						<Chip
							label="Archived"
							onRemove={() => setSearch({ archived: undefined })}
						/>
					)}
					{kind && (
						<Chip
							label={KINDS[kind].label}
							onRemove={() => setSearch({ kind: undefined })}
						/>
					)}
					{fav && (
						<Chip
							label="Favorites"
							onRemove={() => setSearch({ fav: undefined })}
						/>
					)}
					{tags.map((t) => (
						<Chip key={t} label={`#${t}`} onRemove={() => toggleTag(t)} />
					))}
					{filtered && (
						<button
							type="button"
							className="btn btn-ghost btn-sm"
							onClick={clear}
						>
							Clear filters
						</button>
					)}
				</div>
			)}

			{body}

			{form && (
				<BookmarkModal
					key={form.key}
					slug={slug}
					open
					onOpenChange={(o) => !o && setForm(undefined)}
					bookmark={form.bookmark}
					collections={collections}
					collectionId={collection?.id}
					allTags={allTags}
				/>
			)}
			{creatingCollection && (
				<CollectionModal
					slug={slug}
					open={creatingCollection}
					onOpenChange={setCreatingCollection}
					onCreated={(x) => setSearch({ c: x.id })}
				/>
			)}
		</div>
	);
}

function FilterMenu({
	kind,
	fav,
	archived,
	tags,
	placeTags,
	setSearch,
	toggleTag,
}: {
	kind: BookmarkKind | undefined;
	fav: boolean;
	archived: boolean;
	tags: string[];
	placeTags: string[];
	setSearch: (patch: {
		kind?: BookmarkKind;
		fav?: boolean;
		archived?: boolean;
	}) => void;
	toggleTag: (t: string) => void;
}) {
	const count = (kind ? 1 : 0) + (fav ? 1 : 0) + tags.length;
	return (
		<Menu>
			<MenuTrigger className="btn btn-secondary btn-sm">
				<span
					className="icon-[solar--filter-linear] size-3.5"
					aria-hidden="true"
				/>
				Filter
				{count > 0 && <span className="ct">{count}</span>}
			</MenuTrigger>
			<MenuContent width={230} align="start">
				<MenuLabel>Type</MenuLabel>
				{(Object.keys(KINDS) as BookmarkKind[]).map((k) => (
					<MenuItem
						key={k}
						icon={KINDS[k].icon}
						checked={kind === k}
						keepOpen
						onSelect={() => setSearch({ kind: kind === k ? undefined : k })}
					>
						{KINDS[k].label}
					</MenuItem>
				))}
				<MenuSeparator />
				<MenuItem
					icon="icon-[solar--star-linear]"
					checked={fav}
					keepOpen
					onSelect={() => setSearch({ fav: fav ? undefined : true })}
				>
					Favorites only
				</MenuItem>
				<MenuItem
					icon="icon-[solar--archive-linear]"
					checked={archived}
					keepOpen
					onSelect={() => setSearch({ archived: archived ? undefined : true })}
				>
					Show archived
				</MenuItem>
				{placeTags.length > 0 && (
					<>
						<MenuSeparator />
						<MenuLabel>Tags</MenuLabel>
						<div style={{ maxHeight: 220, overflowY: "auto" }}>
							{placeTags.map((t) => (
								<MenuItem
									key={t}
									checked={tags.includes(t)}
									keepOpen
									onSelect={() => toggleTag(t)}
								>
									<span className="trunc">#{t}</span>
								</MenuItem>
							))}
						</div>
					</>
				)}
			</MenuContent>
		</Menu>
	);
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
	return (
		<span className="chip">
			{label}
			<button
				type="button"
				className="ibtn"
				aria-label={`Remove filter ${label}`}
				onClick={onRemove}
			>
				<span
					className="icon-[solar--close-linear] size-3"
					aria-hidden="true"
				/>
			</button>
		</span>
	);
}

function Empty({
	icon,
	title,
	text,
	action,
	secondary,
}: {
	icon: string;
	title: string;
	text: string;
	action?: readonly [string, () => void];
	secondary?: boolean;
}) {
	return (
		<div className="panel">
			<div className="empty-state">
				<div className="glyph">
					<span className={`${icon} size-5`} aria-hidden="true" />
				</div>
				<h2 className="es-h">{title}</h2>
				<p>{text}</p>
				{action && (
					<button
						type="button"
						className={`btn btn-sm ${secondary ? "btn-secondary" : "btn-primary"}`}
						onClick={action[1]}
					>
						{action[0]}
					</button>
				)}
			</div>
		</div>
	);
}
