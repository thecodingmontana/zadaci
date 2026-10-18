import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, tables } from "#/db";
import { cleanUrl, fetchPreview } from "#/lib/link-preview.server";
import {
	can,
	hasRight,
	PROJECT_RIGHTS,
	type ProjectRight,
} from "#/lib/permissions";
import { checkProject, openRight, starred, workspaceOf } from "./notes.server";
import { viewerRight } from "./projects.server";
import {
	badInput,
	type findWorkspaces,
	forbidden,
	type GraphQLContext,
} from "./schema.server";
import { parse } from "./settings.server";

// Saved links in collections. A collection is shared like a note: open to members, private
// to its author, or linked to a project. A bookmark can sit in several collections and is
// visible through any of them; one in no collection is "unsorted" and open to members.
// A private bookmark is only its author's, wherever it's filed.

type Workspace = Awaited<ReturnType<typeof findWorkspaces>>[number];
type Collection = typeof tables.bookmark_collection.$inferSelect;
type Bookmark = typeof tables.bookmark.$inferSelect;
type Rights = Map<string, ProjectRight>;

export const bookmarksTypeDefs = /* GraphQL */ `
	type BookmarkCollection {
		id: ID!
		name: String!
		icon: String
		isPrivate: Boolean!
		projectId: ID
		sortOrder: Float!
		"live bookmarks in it, archived ones left out"
		count: Int!
		canEdit: Boolean!
		"rename aside, changing sharing or deleting needs full access"
		canDelete: Boolean!
		isAuthor: Boolean!
	}

	type Bookmark {
		id: ID!
		url: String!
		title: String!
		description: String
		image: String
		site: String
		"article, document or video"
		kind: String!
		tags: [String!]!
		"the collections the viewer can see it in"
		collectionIds: [ID!]!
		archivedAt: String
		createdBy: ID!
		createdAt: String!
		canEdit: Boolean!
		canDelete: Boolean!
		isFavorite: Boolean!
		"only its author sees it"
		isPrivate: Boolean!
		"the viewer saved it (only they can make it private)"
		isAuthor: Boolean!
	}

	type LinkPreview {
		url: String!
		title: String!
		description: String
		image: String
		site: String
		kind: String!
	}

	input NewBookmark {
		url: String!
		"left out: read from the page"
		title: String
		description: String
		image: String
		kind: String
		tags: [String!]
		collectionIds: [ID!]
		isPrivate: Boolean
	}

	input BookmarkPatch {
		url: String
		title: String
		description: String
		"null removes the image"
		image: String
		kind: String
		tags: [String!]
		"only the author can make a bookmark private or shared again"
		isPrivate: Boolean
		"files it in exactly these collections, like moveBookmark"
		collectionIds: [ID!]
	}

	input NewBookmarkCollection {
		name: String!
		icon: String
		projectId: ID
		isPrivate: Boolean
	}

	input BookmarkCollectionPatch {
		name: String
		icon: String
		projectId: ID
		isPrivate: Boolean
	}

	extend type Query {
		"every bookmark the viewer can see, archived ones included"
		bookmarks(slug: String!): [Bookmark!]!
		bookmarkCollections(slug: String!): [BookmarkCollection!]!
		"a page's title, description and image, for the add form"
		linkPreview(slug: String!, url: String!): LinkPreview!
	}

	extend type Mutation {
		createBookmark(slug: String!, input: NewBookmark!): Bookmark!
		updateBookmark(slug: String!, id: ID!, patch: BookmarkPatch!): Bookmark!
		"puts the bookmark in exactly these collections (ones the viewer can't see stay as they are)"
		moveBookmark(slug: String!, id: ID!, collectionIds: [ID!]!): Bookmark!
		archiveBookmark(slug: String!, id: ID!, archived: Boolean!): Bookmark!
		deleteBookmark(slug: String!, id: ID!): Boolean!
		"stars or unstars a bookmark; returns whether it's now starred"
		toggleBookmarkFavorite(slug: String!, id: ID!): Boolean!
		createBookmarkCollection(
			slug: String!
			input: NewBookmarkCollection!
		): BookmarkCollection!
		updateBookmarkCollection(
			slug: String!
			id: ID!
			patch: BookmarkCollectionPatch!
		): BookmarkCollection!
		"bookmarks that are in no other collection go with it"
		deleteBookmarkCollection(slug: String!, id: ID!): Boolean!
	}
`;

const TITLE = z
	.string()
	.trim()
	.min(1, "Give it a title")
	.max(300, "Keep titles under 300 characters");
const DESCRIPTION = z.string().trim().max(1000).nullable();
const NAME = z
	.string()
	.trim()
	.min(1, "Name the collection")
	.max(100, "Keep names under 100 characters");
const ICON = z.string().trim().max(16).nullable();
const KIND = z.enum(["article", "document", "video"]);
const TAGS = z
	.array(
		z
			.string()
			.transform((t) => t.trim().replace(/^#+/, "").trim())
			.pipe(
				z.string().min(1, "Tags can't be empty").max(40, "Keep tags short"),
			),
	)
	.max(20, "Use at most 20 tags")
	// one spelling per tag, whatever the case
	.transform((tags) => [
		...new Map(tags.map((t) => [t.toLowerCase(), t])).values(),
	]);

const link = (url: string) =>
	cleanUrl(url) ?? badInput("Enter a web address (https://…)");
const image = (url: string | null) => {
	if (url === null || url === "") return null;
	const clean = cleanUrl(url);
	if (!clean?.startsWith("https:")) badInput("That image can't be used");
	return clean;
};

const best = (rights: ProjectRight[]) =>
	rights.reduce<ProjectRight | null>(
		(a, r) =>
			!a || PROJECT_RIGHTS.indexOf(r) > PROJECT_RIGHTS.indexOf(a) ? r : a,
		null,
	);

/** The workspace's live collections and what the viewer may do in each one they can see. */
async function collectionsOf(workspace: Workspace) {
	const all = await db
		.select()
		.from(tables.bookmark_collection)
		.where(
			and(
				eq(tables.bookmark_collection.workspace_id, workspace.id),
				isNull(tables.bookmark_collection.deleted_at),
			),
		)
		.orderBy(tables.bookmark_collection.sort_order);
	// linked collections take their project's right: one lookup per project
	const projectIds = [
		...new Set(all.flatMap((c) => (c.project_id ? [c.project_id] : []))),
	];
	const projects = projectIds.length
		? await db
				.select()
				.from(tables.project)
				.where(
					and(
						inArray(tables.project.id, projectIds),
						isNull(tables.project.deleted_at),
					),
				)
		: [];
	const projectRights = new Map(
		await Promise.all(
			projects.map(
				async (p) => [p.id, await viewerRight(workspace, p)] as const,
			),
		),
	);
	const admin = can(workspace.role, "manageAllProjects", workspace.settings);
	const rights: Rights = new Map();
	for (const c of all) {
		if (c.private && c.created_by !== workspace.memberId) continue;
		const right = !c.project_id
			? openRight(workspace, c.created_by)
			: projectRights.has(c.project_id)
				? (projectRights.get(c.project_id) ?? null)
				: admin // its project was deleted: only admins can clean up
					? "full"
					: null;
		if (right) rights.set(c.id, right);
	}
	return { all, rights };
}

/** What the viewer may do with a bookmark in these collections, or null when they can't see it. */
function bookmarkRight(
	workspace: Workspace,
	b: Pick<Bookmark, "created_by" | "private">,
	inCollections: string[],
	rights: Rights,
) {
	if (b.private && b.created_by !== workspace.memberId) return null;
	if (!inCollections.length) return openRight(workspace, b.created_by);
	const right = best(inCollections.flatMap((id) => rights.get(id) ?? []));
	return right && b.created_by === workspace.memberId ? "full" : right;
}

/** Collection ids per bookmark, for these bookmarks (or all of the workspace's). */
async function memberships(workspaceId: string, bookmarkIds?: string[]) {
	const rows = await db
		.select({
			bookmarkId: tables.bookmark_collections.bookmark_id,
			collectionId: tables.bookmark_collections.collection_id,
		})
		.from(tables.bookmark_collections)
		.innerJoin(
			tables.bookmark,
			eq(tables.bookmark.id, tables.bookmark_collections.bookmark_id),
		)
		.where(
			and(
				eq(tables.bookmark.workspace_id, workspaceId),
				bookmarkIds ? inArray(tables.bookmark.id, bookmarkIds) : undefined,
			),
		);
	const map = new Map<string, string[]>();
	for (const r of rows)
		map.set(r.bookmarkId, [...(map.get(r.bookmarkId) ?? []), r.collectionId]);
	return map;
}

const bookmarkShape = (
	workspace: Workspace,
	b: Bookmark,
	right: ProjectRight | null,
	collectionIds: string[],
	rights: Rights,
	isFavorite: boolean,
) => ({
	id: b.id,
	url: b.url,
	title: b.title,
	description: b.description,
	image: b.image,
	site: b.site,
	kind: b.kind,
	tags: b.tags,
	collectionIds: collectionIds.filter((id) => rights.has(id)),
	archivedAt: b.archived_at?.toISOString() ?? null,
	createdBy: b.created_by,
	createdAt: b.created_at.toISOString(),
	canEdit: hasRight(right, "edit"),
	canDelete: hasRight(right, "full"),
	isFavorite,
	isPrivate: b.private,
	isAuthor: b.created_by === workspace.memberId,
});

const collectionShape = (
	c: Collection,
	right: ProjectRight | null,
	workspace: Workspace,
	count = 0,
) => ({
	id: c.id,
	name: c.name,
	icon: c.icon,
	isPrivate: c.private,
	projectId: c.project_id,
	sortOrder: c.sort_order,
	count,
	canEdit: hasRight(right, "edit"),
	canDelete: hasRight(right, "full"),
	isAuthor: c.created_by === workspace.memberId,
});

/** A bookmark the viewer can see, failing like a missing one when they can't. */
async function requireBookmark(
	ctx: GraphQLContext,
	slug: string,
	id: string,
	need: ProjectRight = "view",
) {
	const { user, workspace } = await workspaceOf(ctx, slug);
	const [bookmark] = await db
		.select()
		.from(tables.bookmark)
		.where(
			and(
				eq(tables.bookmark.id, id),
				eq(tables.bookmark.workspace_id, workspace.id),
				isNull(tables.bookmark.deleted_at),
			),
		);
	if (!bookmark) badInput("Bookmark not found");
	const { rights } = await collectionsOf(workspace);
	const inCollections = (await memberships(workspace.id, [id])).get(id) ?? [];
	const right = bookmarkRight(workspace, bookmark, inCollections, rights);
	if (!right) badInput("Bookmark not found");
	if (!hasRight(right, need)) forbidden();
	return { user, workspace, bookmark, right, rights, inCollections };
}

async function requireCollection(
	ctx: GraphQLContext,
	slug: string,
	id: string,
	need: ProjectRight,
) {
	const { user, workspace } = await workspaceOf(ctx, slug);
	const { all, rights } = await collectionsOf(workspace);
	const collection = all.find((c) => c.id === id);
	const right = rights.get(id) ?? null;
	if (!collection || !right) badInput("Collection not found");
	if (!hasRight(right, need)) forbidden();
	return { user, workspace, collection, right };
}

/** Collection ids the viewer may add bookmarks to (or take them out of). */
function editable(ids: string[], rights: Rights) {
	const unique = [...new Set(ids)];
	for (const id of unique) {
		const right = rights.get(id);
		if (!right) badInput("Collection not found");
		if (!hasRight(right, "edit")) forbidden();
	}
	return unique;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Checks putting a bookmark in exactly these collections; ones the viewer can't see stay. */
function planMove(
	workspace: Workspace,
	bookmark: Bookmark,
	inCollections: string[],
	rights: Rights,
	collectionIds: string[],
) {
	const wanted = [...new Set(collectionIds)];
	if (wanted.some((id) => !rights.has(id))) badInput("Collection not found");
	// only the collections that change need edit rights; ones it stays in just need to be seen
	const added = wanted.filter((id) => !inCollections.includes(id));
	const removed = inCollections.filter(
		(id) => rights.has(id) && !wanted.includes(id),
	);
	editable([...added, ...removed], rights);
	const hidden = inCollections.filter((id) => !rights.has(id));
	// in no collection it's Unsorted and open to every member: only its author decides that
	if (
		removed.length &&
		!wanted.length &&
		!hidden.length &&
		(!can(workspace.role, "workspaceContent", workspace.settings) ||
			bookmark.created_by !== workspace.memberId)
	)
		badInput(
			"Only the person who saved it can take it out of every collection. Delete it, or file it somewhere else.",
		);
	return { wanted, removed };
}

async function applyMove(
	tx: Tx,
	bookmarkId: string,
	{ wanted, removed }: ReturnType<typeof planMove>,
) {
	if (removed.length)
		await tx
			.delete(tables.bookmark_collections)
			.where(
				and(
					eq(tables.bookmark_collections.bookmark_id, bookmarkId),
					inArray(tables.bookmark_collections.collection_id, removed),
				),
			);
	if (wanted.length)
		await tx
			.insert(tables.bookmark_collections)
			.values(
				wanted.map((collection_id) => ({
					bookmark_id: bookmarkId,
					collection_id,
				})),
			)
			.onConflictDoNothing();
}

/** A bookmark as the viewer sees it; pass `rights` when they're already worked out. */
async function oneBookmark(
	id: string,
	workspace: Workspace,
	userId: string,
	known?: Rights,
) {
	const [b] = await db
		.select()
		.from(tables.bookmark)
		.where(eq(tables.bookmark.id, id));
	if (!b) badInput("Bookmark not found");
	const rights = known ?? (await collectionsOf(workspace)).rights;
	const inCollections = (await memberships(workspace.id, [id])).get(id) ?? [];
	const stars = await starred(userId, workspace.id, "bookmark");
	return bookmarkShape(
		workspace,
		b,
		bookmarkRight(workspace, b, inCollections, rights),
		inCollections,
		rights,
		stars.has(id),
	);
}

async function oneCollection(id: string, workspace: Workspace) {
	const { all, rights } = await collectionsOf(workspace);
	const c = all.find((x) => x.id === id);
	if (!c) badInput("Collection not found");
	return collectionShape(c, rights.get(id) ?? null, workspace);
}

// shortcut: a per-instance counter, so each server instance allows this many previews per
// user each minute; move it to the database or a shared store if previews get abused
const PREVIEWS_PER_MINUTE = 30;
const previewCalls = new Map<string, { count: number; until: number }>();
function limitPreviews(userId: string) {
	const now = Date.now();
	const entry = previewCalls.get(userId);
	if (!entry || entry.until < now) {
		previewCalls.set(userId, { count: 1, until: now + 60_000 });
		return;
	}
	if (++entry.count > PREVIEWS_PER_MINUTE)
		badInput("Too many links at once. Try again in a minute.");
}

async function preview(userId: string, url: string) {
	limitPreviews(userId);
	try {
		return await fetchPreview(url);
	} catch (error) {
		badInput((error as Error).message);
	}
}

// shortcut: the page loads every bookmark (newest first, up to this many) and filters in
// the browser; page through them on the server if a workspace saves more
const MAX_BOOKMARKS = 2000;

export const bookmarksResolvers = {
	Query: {
		bookmarks: async (
			_: unknown,
			args: { slug: string },
			ctx: GraphQLContext,
		) => {
			const { user, workspace } = await workspaceOf(ctx, args.slug);
			const [{ rights }, inCollections, stars, rows] = await Promise.all([
				collectionsOf(workspace),
				memberships(workspace.id),
				starred(user.id, workspace.id, "bookmark"),
				db
					.select()
					.from(tables.bookmark)
					.where(
						and(
							eq(tables.bookmark.workspace_id, workspace.id),
							isNull(tables.bookmark.deleted_at),
						),
					)
					.orderBy(desc(tables.bookmark.created_at))
					.limit(MAX_BOOKMARKS),
			]);
			return rows.flatMap((b) => {
				const ids = inCollections.get(b.id) ?? [];
				const right = bookmarkRight(workspace, b, ids, rights);
				return right
					? [bookmarkShape(workspace, b, right, ids, rights, stars.has(b.id))]
					: [];
			});
		},
		bookmarkCollections: async (
			_: unknown,
			args: { slug: string },
			ctx: GraphQLContext,
		) => {
			const { workspace } = await workspaceOf(ctx, args.slug);
			const { all, rights } = await collectionsOf(workspace);
			const counts = await db
				.select({
					id: tables.bookmark_collections.collection_id,
					count: sql<number>`count(*)::int`,
				})
				.from(tables.bookmark_collections)
				.innerJoin(
					tables.bookmark,
					eq(tables.bookmark.id, tables.bookmark_collections.bookmark_id),
				)
				.where(
					and(
						eq(tables.bookmark.workspace_id, workspace.id),
						isNull(tables.bookmark.deleted_at),
						isNull(tables.bookmark.archived_at),
						or(
							eq(tables.bookmark.private, false),
							eq(tables.bookmark.created_by, workspace.memberId ?? ""),
						),
					),
				)
				.groupBy(tables.bookmark_collections.collection_id);
			const countOf = new Map(counts.map((c) => [c.id, c.count]));
			return all.flatMap((c) => {
				const right = rights.get(c.id);
				return right
					? [collectionShape(c, right, workspace, countOf.get(c.id) ?? 0)]
					: [];
			});
		},
		linkPreview: async (
			_: unknown,
			args: { slug: string; url: string },
			ctx: GraphQLContext,
		) => {
			const { user } = await workspaceOf(ctx, args.slug);
			return preview(user.id, args.url);
		},
	},
	Mutation: {
		createBookmark: async (
			_: unknown,
			args: {
				slug: string;
				input: {
					url: string;
					title?: string | null;
					description?: string | null;
					image?: string | null;
					kind?: string | null;
					tags?: string[] | null;
					collectionIds?: string[] | null;
					isPrivate?: boolean | null;
				};
			},
			ctx: GraphQLContext,
		) => {
			const { input } = args;
			const { user, workspace } = await workspaceOf(ctx, args.slug);
			const url = link(input.url);
			const tags = parse(TAGS, input.tags ?? []);
			const { rights } = await collectionsOf(workspace);
			const collectionIds = editable(input.collectionIds ?? [], rights);
			// guests only work inside projects, so their bookmarks need a collection
			if (
				!collectionIds.length &&
				!can(workspace.role, "workspaceContent", workspace.settings)
			)
				forbidden();
			// a quick add with just a link: read the rest from the page
			const page = input.title ? null : await preview(user.id, url);
			const [row] = await db.transaction(async (tx) => {
				const rows = await tx
					.insert(tables.bookmark)
					.values({
						workspace_id: workspace.id,
						url,
						title: parse(TITLE, input.title ?? page?.title),
						description: parse(
							DESCRIPTION,
							input.description ?? page?.description ?? null,
						),
						image: image(input.image ?? page?.image ?? null),
						site: page?.site ?? new URL(url).hostname.replace(/^www\./, ""),
						kind: parse(KIND, input.kind ?? page?.kind ?? "article"),
						tags,
						private: !!input.isPrivate,
						created_by: workspace.memberId ?? "",
					})
					.returning({ id: tables.bookmark.id });
				const id = rows[0]?.id;
				if (!id) throw new Error("Bookmark insert returned nothing");
				if (collectionIds.length)
					await tx.insert(tables.bookmark_collections).values(
						collectionIds.map((collection_id) => ({
							bookmark_id: id,
							collection_id,
						})),
					);
				return rows;
			});
			if (!row) throw new Error("Bookmark insert returned nothing");
			return oneBookmark(row.id, workspace, user.id, rights);
		},

		updateBookmark: async (
			_: unknown,
			args: {
				slug: string;
				id: string;
				patch: {
					url?: string | null;
					title?: string | null;
					description?: string | null;
					image?: string | null;
					kind?: string | null;
					tags?: string[] | null;
					isPrivate?: boolean | null;
					collectionIds?: string[] | null;
				};
			},
			ctx: GraphQLContext,
		) => {
			const { user, workspace, bookmark, rights, inCollections } =
				await requireBookmark(ctx, args.slug, args.id, "edit");
			const { patch } = args;
			const set: Partial<typeof tables.bookmark.$inferInsert> = {};
			if (patch.url != null) {
				set.url = link(patch.url);
				set.site = new URL(set.url).hostname.replace(/^www\./, "");
			}
			if (patch.title != null) set.title = parse(TITLE, patch.title);
			if (patch.description !== undefined)
				set.description = parse(DESCRIPTION, patch.description || null);
			if (patch.image !== undefined) set.image = image(patch.image);
			if (patch.kind != null) set.kind = parse(KIND, patch.kind);
			if (patch.tags != null) set.tags = parse(TAGS, patch.tags);
			if (patch.isPrivate != null && patch.isPrivate !== bookmark.private) {
				// nobody can hide or expose someone else's bookmark
				if (bookmark.created_by !== workspace.memberId) forbidden();
				set.private = patch.isPrivate;
			}
			const move =
				patch.collectionIds &&
				planMove(
					workspace,
					bookmark,
					inCollections,
					rights,
					patch.collectionIds,
				);
			// the fields and the filing save together, or not at all
			await db.transaction(async (tx) => {
				if (Object.keys(set).length)
					await tx
						.update(tables.bookmark)
						.set(set)
						.where(eq(tables.bookmark.id, bookmark.id));
				if (move) await applyMove(tx, bookmark.id, move);
			});
			return oneBookmark(bookmark.id, workspace, user.id, rights);
		},

		moveBookmark: async (
			_: unknown,
			args: { slug: string; id: string; collectionIds: string[] },
			ctx: GraphQLContext,
		) => {
			const { user, workspace, bookmark, rights, inCollections } =
				await requireBookmark(ctx, args.slug, args.id, "edit");
			const move = planMove(
				workspace,
				bookmark,
				inCollections,
				rights,
				args.collectionIds,
			);
			await db.transaction((tx) => applyMove(tx, bookmark.id, move));
			return oneBookmark(bookmark.id, workspace, user.id, rights);
		},

		archiveBookmark: async (
			_: unknown,
			args: { slug: string; id: string; archived: boolean },
			ctx: GraphQLContext,
		) => {
			const { user, workspace, bookmark, rights } = await requireBookmark(
				ctx,
				args.slug,
				args.id,
				"edit",
			);
			await db
				.update(tables.bookmark)
				.set({ archived_at: args.archived ? new Date() : null })
				.where(eq(tables.bookmark.id, bookmark.id));
			return oneBookmark(bookmark.id, workspace, user.id, rights);
		},

		deleteBookmark: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const { bookmark } = await requireBookmark(
				ctx,
				args.slug,
				args.id,
				"full",
			);
			await db
				.update(tables.bookmark)
				.set({ deleted_at: new Date() })
				.where(eq(tables.bookmark.id, bookmark.id));
			return true;
		},

		toggleBookmarkFavorite: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const { user, workspace, bookmark } = await requireBookmark(
				ctx,
				args.slug,
				args.id,
			);
			const where = and(
				eq(tables.favorite.user_id, user.id),
				eq(tables.favorite.entity_type, "bookmark"),
				eq(tables.favorite.entity_id, bookmark.id),
			);
			const removed = await db
				.delete(tables.favorite)
				.where(where)
				.returning({ id: tables.favorite.id });
			if (removed.length) return false;
			await db
				.insert(tables.favorite)
				.values({
					user_id: user.id,
					workspace_id: workspace.id,
					entity_type: "bookmark",
					entity_id: bookmark.id,
				})
				.onConflictDoNothing();
			return true;
		},

		createBookmarkCollection: async (
			_: unknown,
			args: {
				slug: string;
				input: {
					name: string;
					icon?: string | null;
					projectId?: string | null;
					isPrivate?: boolean | null;
				};
			},
			ctx: GraphQLContext,
		) => {
			const { input } = args;
			const name = parse(NAME, input.name);
			const icon = parse(ICON, input.icon ?? null);
			const { workspace } = await workspaceOf(ctx, args.slug);
			const projectId = input.projectId ?? null;
			if (projectId) await checkProject(workspace, projectId);
			else if (!can(workspace.role, "workspaceContent", workspace.settings))
				forbidden();
			const [last] = await db
				.select({
					max: sql<number>`coalesce(max(${tables.bookmark_collection.sort_order}), 0)`,
				})
				.from(tables.bookmark_collection)
				.where(eq(tables.bookmark_collection.workspace_id, workspace.id));
			const [row] = await db
				.insert(tables.bookmark_collection)
				.values({
					workspace_id: workspace.id,
					name,
					icon,
					project_id: projectId,
					private: !!input.isPrivate,
					sort_order: Number(last?.max ?? 0) + 1,
					created_by: workspace.memberId ?? "",
				})
				.returning({ id: tables.bookmark_collection.id });
			if (!row) throw new Error("Collection insert returned nothing");
			return oneCollection(row.id, workspace);
		},

		updateBookmarkCollection: async (
			_: unknown,
			args: {
				slug: string;
				id: string;
				patch: {
					name?: string | null;
					icon?: string | null;
					projectId?: string | null;
					isPrivate?: boolean | null;
				};
			},
			ctx: GraphQLContext,
		) => {
			const { workspace, collection, right } = await requireCollection(
				ctx,
				args.slug,
				args.id,
				"edit",
			);
			const { patch } = args;
			const set: Partial<typeof tables.bookmark_collection.$inferInsert> = {};
			if (patch.name != null) set.name = parse(NAME, patch.name);
			if (patch.icon !== undefined) set.icon = parse(ICON, patch.icon);
			if (
				patch.projectId !== undefined &&
				patch.projectId !== collection.project_id
			) {
				// moving it between projects changes who can see its bookmarks
				if (right !== "full") forbidden();
				if (patch.projectId) await checkProject(workspace, patch.projectId);
				else if (!can(workspace.role, "workspaceContent", workspace.settings))
					forbidden();
				set.project_id = patch.projectId;
			}
			if (patch.isPrivate != null && patch.isPrivate !== collection.private) {
				if (collection.created_by !== workspace.memberId) forbidden();
				set.private = patch.isPrivate;
			}
			if (Object.keys(set).length)
				await db
					.update(tables.bookmark_collection)
					.set(set)
					.where(eq(tables.bookmark_collection.id, collection.id));
			return oneCollection(collection.id, workspace);
		},

		deleteBookmarkCollection: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const { workspace, collection } = await requireCollection(
				ctx,
				args.slug,
				args.id,
				"full",
			);
			const bc = tables.bookmark_collections;
			await db.transaction(async (tx) => {
				// its bookmarks that are nowhere else go too, rather than becoming unsorted
				// (which would open a private collection's links to the whole workspace)
				const inside = tx
					.select({ id: bc.bookmark_id })
					.from(bc)
					.where(eq(bc.collection_id, collection.id));
				const elsewhere = tx
					.select({ id: bc.bookmark_id })
					.from(bc)
					.where(ne(bc.collection_id, collection.id));
				await tx
					.update(tables.bookmark)
					.set({ deleted_at: new Date() })
					.where(
						and(
							inArray(tables.bookmark.id, inside),
							sql`${tables.bookmark.id} not in ${elsewhere}`,
							// someone else's private bookmark (unseen by whoever deletes) stays,
							// unsorted but still private to its author
							or(
								eq(tables.bookmark.private, false),
								eq(tables.bookmark.created_by, workspace.memberId ?? ""),
							),
						),
					);
				await tx.delete(bc).where(eq(bc.collection_id, collection.id));
				await tx
					.update(tables.bookmark_collection)
					.set({ deleted_at: new Date() })
					.where(eq(tables.bookmark_collection.id, collection.id));
			});
			return true;
		},
	},
};
