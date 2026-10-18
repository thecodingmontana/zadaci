import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { GraphQLError } from "graphql";
import { z } from "zod";
import { db, tables } from "#/db";
import { generateNanoId } from "#/db/utils";
import { isCover } from "#/lib/note-covers";
import { checkDoc } from "#/lib/note-doc";
import { can, hasRight, type ProjectRight } from "#/lib/permissions";
import { viewerRight } from "./projects.server";
import {
	badInput,
	findWorkspaces,
	forbidden,
	type GraphQLContext,
	projectScope,
	requireUser,
} from "./schema.server";
import { cloudinary, parse, signCloudinary } from "./settings.server";
import { commentRows, oneComment, shape } from "./task-extras.server";

// Notes are pages, Notion style: any page can hold sub-pages (parent_id), so the sidebar
// is a tree and grouping is nesting. A page linked to a project follows that project's
// sharing; other pages are open to the workspace's members (not guests).

type NoteRow = typeof tables.note.$inferSelect;
type Workspace = Awaited<ReturnType<typeof findWorkspaces>>[number];

export const notesTypeDefs = /* GraphQL */ `
	type Note {
		id: ID!
		parentId: ID
		sortOrder: Float!
		icon: String
		"a gallery colour or gradient (gallery:<key>) or an image URL"
		cover: String
		coverY: Int!
		title: String!
		projectId: ID
		"Tiptap JSON; only loaded when asked for"
		doc: JSON
		"first lines of plain text, for lists and search results"
		excerpt: String!
		createdBy: ID!
		updatedBy: ID
		createdAt: String!
		updatedAt: String!
		canEdit: Boolean!
		"the author and admins (or full access on the linked project) may delete"
		canDelete: Boolean!
		"only the author sees it"
		isPrivate: Boolean!
		"starred by the viewer"
		isFavorite: Boolean!
		"the viewer wrote it (only they can make it private)"
		isAuthor: Boolean!
		comments: [TaskComment!]!
	}

	input NewNote {
		parentId: ID
		title: String
		icon: String
		projectId: ID
	}

	input NotePatch {
		title: String
		icon: String
		doc: JSON
		projectId: ID
		"only the author can make a page private or shared again"
		isPrivate: Boolean
		"null removes the cover"
		cover: String
		coverY: Int
	}

	extend type Query {
		"every page the viewer can see, without bodies (the sidebar tree)"
		notes(slug: String!): [Note!]!
		note(slug: String!, id: ID!): Note
	}

	extend type Mutation {
		createNote(slug: String!, input: NewNote!): Note!
		"baseUpdatedAt: when the editor last loaded the page, to catch someone else's newer save"
		updateNote(
			slug: String!
			id: ID!
			patch: NotePatch!
			baseUpdatedAt: String
		): Note!
		"parentId null moves the page to the top level; sortOrder places it among its new siblings"
		moveNote(slug: String!, id: ID!, parentId: ID, sortOrder: Float!): Note!
		duplicateNote(slug: String!, id: ID!): Note!
		"removes the page and everything under it"
		deleteNote(slug: String!, id: ID!): Boolean!
		addNoteComment(
			slug: String!
			noteId: ID!
			text: String!
			quote: String
			parentId: ID
		): TaskComment!
		resolveNoteComment(slug: String!, id: ID!, resolved: Boolean!): TaskComment!
		"a signed slot for uploading this page's cover image"
		noteCoverUpload(slug: String!, id: ID!): CloudinaryUpload!
		"stars or unstars a page; returns whether it's now starred"
		toggleNoteFavorite(slug: String!, id: ID!): Boolean!
	}
`;

const coverFolder = (noteId: string) => `zadaci/notes/${noteId}`;

const TITLE = z.string().trim().max(200, "Keep titles under 200 characters");
const ICON = z.string().trim().max(16).nullable();

/** An unlinked page's right: admins and its author have full access, members edit. */
const unlinkedRight = (
	workspace: Workspace,
	note: NoteRow,
): ProjectRight | null =>
	workspace.role === "guest"
		? null
		: can(workspace.role, "manageAllProjects") ||
				note.created_by === workspace.memberId
			? "full"
			: "edit";

const hiddenFrom = (workspace: Workspace, note: NoteRow) =>
	note.private && note.created_by !== workspace.memberId;

/** What the viewer may do on a page, or null when they can't see it. */
async function noteRight(workspace: Workspace, note: NoteRow) {
	if (hiddenFrom(workspace, note)) return null;
	if (note.project_id) {
		const [project] = await db
			.select()
			.from(tables.project)
			.where(
				and(
					eq(tables.project.id, note.project_id),
					isNull(tables.project.deleted_at),
				),
			);
		if (project) return viewerRight(workspace, project);
		// its project was deleted: don't fall back to "every member", only admins can clean up
		return can(workspace.role, "manageAllProjects") ? "full" : null;
	}
	return unlinkedRight(workspace, note);
}

async function workspaceOf(ctx: GraphQLContext, slug: string) {
	const user = requireUser(ctx);
	const [workspace] = await findWorkspaces(user.id, slug);
	if (!workspace)
		throw new GraphQLError("Workspace not found", {
			extensions: { code: "NOT_FOUND" },
		});
	return { user, workspace };
}

/** A page the viewer can see, failing like a missing page when they can't. */
export async function requireNote(
	ctx: GraphQLContext,
	slug: string,
	id: string,
	need: ProjectRight = "view",
) {
	const { user, workspace } = await workspaceOf(ctx, slug);
	const [note] = await db
		.select()
		.from(tables.note)
		.where(
			and(
				eq(tables.note.id, id),
				eq(tables.note.workspace_id, workspace.id),
				isNull(tables.note.deleted_at),
			),
		);
	if (!note) badInput("Note not found");
	const right = await noteRight(workspace, note);
	if (!right) badInput("Note not found");
	if (!hasRight(right, need)) forbidden();
	return { user, workspace, note, right };
}

/** Pages the viewer can see: members see unlinked pages, everyone sees their projects' pages. */
function visible(workspace: Workspace) {
	const scope = projectScope(workspace, tables.note.project_id);
	return and(
		eq(tables.note.workspace_id, workspace.id),
		isNull(tables.note.deleted_at),
		or(
			eq(tables.note.private, false),
			eq(tables.note.created_by, workspace.memberId ?? ""),
		),
		scope &&
			or(
				workspace.role === "guest" ? undefined : isNull(tables.note.project_id),
				scope,
			),
	);
}

/**
 * Copies a page's sharing down to the pages inside it. A project applies to all of them;
 * privacy only to the actor's own pages, so nobody can expose or hide someone else's page.
 * Leaves updated_at alone, so people editing those pages don't hit a false conflict.
 */
async function applySharing(
	tx: Tx,
	ids: string[],
	actorMemberId: string | undefined,
	share: Share,
) {
	if (!ids.length) return;
	const keep = { updated_at: sql`${tables.note.updated_at}` };
	if (share.project_id !== undefined)
		await tx
			.update(tables.note)
			.set({ project_id: share.project_id, ...keep })
			.where(inArray(tables.note.id, ids));
	if (share.private !== undefined)
		await tx
			.update(tables.note)
			.set({ private: share.private, ...keep })
			.where(
				and(
					inArray(tables.note.id, ids),
					eq(tables.note.created_by, actorMemberId ?? ""),
				),
			);
}

const noteShape = (
	n: NoteRow,
	right: ProjectRight | null,
	viewer: { memberId?: string },
	isFavorite = false,
) => ({
	id: n.id,
	parentId: n.parent_id,
	sortOrder: n.sort_order,
	icon: n.icon,
	cover: n.cover,
	coverY: n.cover_y,
	title: n.title,
	projectId: n.project_id,
	excerpt: (n.content ?? "").replace(/\s+/g, " ").slice(0, 160),
	createdBy: n.created_by,
	updatedBy: n.updated_by,
	createdAt: n.created_at.toISOString(),
	updatedAt: n.updated_at.toISOString(),
	canEdit: hasRight(right, "edit"),
	canDelete: hasRight(right, "full"),
	isPrivate: n.private,
	isFavorite,
	isAuthor: n.created_by === viewer.memberId,
});

/** Ids of the pages the user starred in this workspace. */
async function starred(userId: string, workspaceId: string) {
	const rows = await db
		.select({ id: tables.favorite.entity_id })
		.from(tables.favorite)
		.where(
			and(
				eq(tables.favorite.user_id, userId),
				eq(tables.favorite.workspace_id, workspaceId),
				eq(tables.favorite.entity_type, "note"),
			),
		);
	return new Set(rows.map((r) => r.id));
}

/** A project the viewer may edit in, for linking a page to it. */
async function checkProject(workspace: Workspace, projectId: string) {
	const [project] = await db
		.select()
		.from(tables.project)
		.where(
			and(
				eq(tables.project.id, projectId),
				eq(tables.project.workspace_id, workspace.id),
				isNull(tables.project.deleted_at),
			),
		);
	if (!project) badInput("Project not found");
	if (!hasRight(await viewerRight(workspace, project), "edit")) forbidden();
}

async function lastSibling(workspaceId: string, parentId: string | null) {
	const [row] = await db
		.select({ max: sql<number>`coalesce(max(${tables.note.sort_order}), 0)` })
		.from(tables.note)
		.where(
			and(
				eq(tables.note.workspace_id, workspaceId),
				parentId
					? eq(tables.note.parent_id, parentId)
					: isNull(tables.note.parent_id),
				isNull(tables.note.deleted_at),
			),
		);
	return Number(row?.max ?? 0);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Share = { project_id?: string | null; private?: boolean };

/** Ids of a page and every live page under it. */
async function subtree(id: string, q: typeof db | Tx = db) {
	const result = await q.execute<{ id: string }>(sql`
		with recursive t as (
			select id from ${tables.note} where id = ${id}
			union
			select n.id from ${tables.note} n join t on n.parent_id = t.id
			where n.deleted_at is null
		)
		select id from t
	`);
	return [...result].map((r) => r.id);
}

async function oneNote(id: string, workspace: Workspace, userId: string) {
	const [note] = await db
		.select()
		.from(tables.note)
		.where(eq(tables.note.id, id));
	if (!note) badInput("Note not found");
	const stars = await starred(userId, workspace.id);
	return noteShape(
		note,
		await noteRight(workspace, note),
		workspace,
		stars.has(id),
	);
}

/** Guests may only add top-level pages inside a project they can edit. */
function canOwnTopLevel(workspace: Workspace, projectId: string | null) {
	if (!projectId && workspace.role === "guest") forbidden();
}

export const notesResolvers = {
	Note: {
		doc: async (n: { id: string; doc?: unknown }) => {
			if (n.doc !== undefined) return n.doc;
			const [row] = await db
				.select({ doc: tables.note.doc })
				.from(tables.note)
				.where(eq(tables.note.id, n.id));
			return row?.doc ?? null;
		},
		comments: async (n: { id: string }, _: unknown, ctx: GraphQLContext) =>
			shape(
				await commentRows(
					and(
						eq(tables.comment.entity_type, "note"),
						eq(tables.comment.entity_id, n.id),
						isNull(tables.comment.deleted_at),
					),
				),
				requireUser(ctx).id,
			),
	},
	Query: {
		notes: async (_: unknown, args: { slug: string }, ctx: GraphQLContext) => {
			const { user, workspace } = await workspaceOf(ctx, args.slug);
			const stars = await starred(user.id, workspace.id);
			const rows = await db
				.select()
				.from(tables.note)
				.where(visible(workspace))
				.orderBy(asc(tables.note.sort_order), desc(tables.note.created_at));
			// linked pages take their project's right: one lookup per project, not per page
			const projectIds = [
				...new Set(rows.flatMap((r) => (r.project_id ? [r.project_id] : []))),
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
			const admin = can(workspace.role, "manageAllProjects");
			const rights = new Map(
				await Promise.all(
					projects.map(
						async (p) => [p.id, await viewerRight(workspace, p)] as const,
					),
				),
			);
			return rows.flatMap((n) => {
				const right = !n.project_id
					? unlinkedRight(workspace, n)
					: rights.has(n.project_id)
						? (rights.get(n.project_id) ?? null)
						: admin // its project was deleted
							? "full"
							: null;
				return right ? [noteShape(n, right, workspace, stars.has(n.id))] : [];
			});
		},
		note: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const { user, workspace, note, right } = await requireNote(
				ctx,
				args.slug,
				args.id,
			);
			const stars = await starred(user.id, workspace.id);
			return {
				...noteShape(note, right, workspace, stars.has(note.id)),
				doc: note.doc,
			};
		},
	},
	Mutation: {
		createNote: async (
			_: unknown,
			args: {
				slug: string;
				input: {
					parentId?: string | null;
					title?: string | null;
					icon?: string | null;
					projectId?: string | null;
				};
			},
			ctx: GraphQLContext,
		) => {
			const { input } = args;
			const title = parse(TITLE, input.title ?? "");
			const icon = parse(ICON, input.icon ?? null);
			const parentId = input.parentId ?? null;
			let projectId = input.projectId ?? null;
			let isPrivate = false;
			const { user } = await workspaceOf(ctx, args.slug);
			let workspace: Workspace;
			if (parentId) {
				// a sub-page lives under its parent's sharing
				const parent = await requireNote(ctx, args.slug, parentId, "edit");
				workspace = parent.workspace;
				projectId = parent.note.project_id;
				isPrivate = parent.note.private;
			} else {
				workspace = (await workspaceOf(ctx, args.slug)).workspace;
				if (projectId) await checkProject(workspace, projectId);
				canOwnTopLevel(workspace, projectId);
			}
			const [row] = await db
				.insert(tables.note)
				.values({
					workspace_id: workspace.id,
					parent_id: parentId,
					project_id: projectId,
					private: isPrivate,
					title,
					icon,
					sort_order: (await lastSibling(workspace.id, parentId)) + 1,
					created_by: workspace.memberId ?? "",
					updated_by: workspace.memberId ?? null,
				})
				.returning({ id: tables.note.id });
			if (!row) throw new Error("Note insert returned nothing");
			return oneNote(row.id, workspace, user.id);
		},

		updateNote: async (
			_: unknown,
			args: {
				slug: string;
				id: string;
				patch: {
					title?: string | null;
					icon?: string | null;
					doc?: unknown;
					projectId?: string | null;
					isPrivate?: boolean | null;
					cover?: string | null;
					coverY?: number | null;
				};
				baseUpdatedAt?: string | null;
			},
			ctx: GraphQLContext,
		) => {
			const { user, workspace, note, right } = await requireNote(
				ctx,
				args.slug,
				args.id,
				"edit",
			);
			const { patch } = args;
			// only content edits count as editing; sharing changes keep the version as it is
			const edits = [
				patch.title,
				patch.icon,
				patch.doc,
				patch.cover,
				patch.coverY,
			].some((v) => v !== undefined);
			const set: PgUpdateSetSource<typeof tables.note> = edits
				? { updated_by: workspace.memberId ?? null }
				: { updated_at: sql`${tables.note.updated_at}` };
			if (patch.title != null) set.title = parse(TITLE, patch.title);
			if (patch.icon !== undefined) set.icon = parse(ICON, patch.icon);
			if (patch.cover !== undefined) {
				// a gallery colour or gradient, or an https image (an upload or a link)
				if (patch.cover !== null && !isCover(patch.cover))
					badInput("That cover can't be used");
				set.cover = patch.cover;
			}
			if (patch.coverY != null)
				set.cover_y = Math.round(Math.min(100, Math.max(0, patch.coverY)));
			if (patch.doc !== undefined) {
				let checked: ReturnType<typeof checkDoc>;
				try {
					checked = checkDoc(patch.doc);
				} catch (error) {
					badInput((error as Error).message);
				}
				set.doc = checked.doc;
				set.content = checked.text;
			}
			// sharing (project, privacy) applies to the page and the pages inside it
			const share: Share = {};
			if (
				patch.projectId !== undefined &&
				patch.projectId !== note.project_id
			) {
				if (note.parent_id)
					badInput("Sub-pages follow their parent page's project");
				// moving pages between projects changes who can see them
				if (right !== "full") forbidden();
				if (patch.projectId) await checkProject(workspace, patch.projectId);
				canOwnTopLevel(workspace, patch.projectId);
				share.project_id = patch.projectId;
			}
			if (patch.isPrivate != null && patch.isPrivate !== note.private) {
				if (note.created_by !== workspace.memberId) forbidden();
				share.private = patch.isPrivate;
			}
			const below =
				share.project_id !== undefined || share.private !== undefined
					? await subtree(note.id)
					: [];
			await db.transaction(async (tx) => {
				const saved = await tx
					.update(tables.note)
					.set(set)
					.where(
						and(
							eq(tables.note.id, note.id),
							// someone saved since this editor loaded the page: don't overwrite it
							args.baseUpdatedAt
								? eq(tables.note.updated_at, new Date(args.baseUpdatedAt))
								: undefined,
						),
					)
					.returning({ id: tables.note.id });
				if (!saved.length)
					throw new GraphQLError("Someone else changed this note", {
						extensions: { code: "CONFLICT" },
					});
				await applySharing(tx, below, workspace.memberId, share);
			});
			return oneNote(note.id, workspace, user.id);
		},

		moveNote: async (
			_: unknown,
			args: {
				slug: string;
				id: string;
				parentId?: string | null;
				sortOrder: number;
			},
			ctx: GraphQLContext,
		) => {
			const { user, workspace, note, right } = await requireNote(
				ctx,
				args.slug,
				args.id,
				"edit",
			);
			if (!Number.isFinite(args.sortOrder)) badInput("Bad position");
			const parentId = args.parentId ?? null;
			const ids = await subtree(note.id);
			let projectId = note.project_id;
			let isPrivate = note.private;
			if (parentId) {
				if (ids.includes(parentId)) badInput("A page can't go inside itself");
				const parent = await requireNote(ctx, args.slug, parentId, "edit");
				projectId = parent.note.project_id;
				isPrivate = parent.note.private;
			} else canOwnTopLevel(workspace, projectId);
			// moving into another project changes who can see the pages
			if (projectId !== note.project_id && right !== "full") forbidden();
			await db.transaction(async (tx) => {
				// re-check inside the write: two moves at once could otherwise make a loop
				if (parentId && (await subtree(note.id, tx)).includes(parentId))
					badInput("A page can't go inside itself");
				await tx
					.update(tables.note)
					.set({
						parent_id: parentId,
						sort_order: args.sortOrder,
						// moving isn't editing: open editors keep saving without a conflict
						updated_at: sql`${tables.note.updated_at}`,
					})
					.where(eq(tables.note.id, note.id));
				// moved pages take their new parent's sharing
				await applySharing(tx, ids, workspace.memberId, {
					...(projectId !== note.project_id && { project_id: projectId }),
					...(isPrivate !== note.private && { private: isPrivate }),
				});
			});
			return oneNote(note.id, workspace, user.id);
		},

		duplicateNote: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const { user, workspace, note } = await requireNote(
				ctx,
				args.slug,
				args.id,
			);
			if (note.parent_id)
				await requireNote(ctx, args.slug, note.parent_id, "edit");
			else {
				if (note.project_id) await checkProject(workspace, note.project_id);
				canOwnTopLevel(workspace, note.project_id);
			}
			const [row] = await db
				.insert(tables.note)
				.values({
					workspace_id: workspace.id,
					parent_id: note.parent_id,
					project_id: note.project_id,
					private: note.private,
					title: `${note.title || "Untitled"} (copy)`.slice(0, 200),
					icon: note.icon,
					doc: note.doc,
					content: note.content,
					// just after the original
					sort_order: note.sort_order + 0.5,
					created_by: workspace.memberId ?? "",
					updated_by: workspace.memberId ?? null,
				})
				.returning({ id: tables.note.id });
			if (!row) throw new Error("Note insert returned nothing");
			return oneNote(row.id, workspace, user.id);
		},

		deleteNote: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const { note } = await requireNote(ctx, args.slug, args.id, "full");
			await db
				.update(tables.note)
				.set({ deleted_at: new Date() })
				.where(inArray(tables.note.id, await subtree(note.id)));
			return true;
		},

		addNoteComment: async (
			_: unknown,
			args: {
				slug: string;
				noteId: string;
				text: string;
				quote?: string | null;
				parentId?: string | null;
			},
			ctx: GraphQLContext,
		) => {
			const text = args.text.trim();
			if (!text) badInput("Write a comment first");
			if (text.length > 10_000)
				badInput("Keep comments under 10,000 characters");
			const { user, workspace, note } = await requireNote(
				ctx,
				args.slug,
				args.noteId,
				"comment",
			);
			if (args.parentId) {
				const [parent] = await db
					.select({ entityId: tables.comment.entity_id })
					.from(tables.comment)
					.where(
						and(
							eq(tables.comment.id, args.parentId),
							eq(tables.comment.entity_type, "note"),
							isNull(tables.comment.deleted_at),
						),
					);
				if (parent?.entityId !== note.id) badInput("Comment not found");
			}
			const quote = args.quote?.trim().slice(0, 500);
			const [row] = await db
				.insert(tables.comment)
				.values({
					entity_type: "note",
					entity_id: note.id,
					author_id: workspace.memberId ?? "",
					content: text,
					parent_id: args.parentId ?? null,
					anchor: quote ? { quote } : null,
				})
				.returning({ id: tables.comment.id });
			if (!row) throw new Error("Comment insert returned nothing");
			return oneComment(row.id, user.id);
		},

		noteCoverUpload: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const { note } = await requireNote(ctx, args.slug, args.id, "edit");
			const { cloud, key, secret } = cloudinary();
			const params = {
				folder: coverFolder(note.id),
				public_id: generateNanoId().toLowerCase(),
				timestamp: Math.floor(Date.now() / 1000),
			};
			return {
				url: `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
				apiKey: key,
				timestamp: params.timestamp,
				signature: signCloudinary(params, secret),
				publicId: params.public_id,
				folder: params.folder,
			};
		},

		toggleNoteFavorite: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const { user, workspace, note } = await requireNote(
				ctx,
				args.slug,
				args.id,
			);
			const where = and(
				eq(tables.favorite.user_id, user.id),
				eq(tables.favorite.entity_type, "note"),
				eq(tables.favorite.entity_id, note.id),
			);
			const [existing] = await db
				.select({ id: tables.favorite.id })
				.from(tables.favorite)
				.where(where);
			if (existing) {
				await db.delete(tables.favorite).where(where);
				return false;
			}
			await db
				.insert(tables.favorite)
				.values({
					user_id: user.id,
					workspace_id: workspace.id,
					entity_type: "note",
					entity_id: note.id,
				})
				// a double click: the first insert won, which is the same result
				.onConflictDoNothing();
			return true;
		},

		resolveNoteComment: async (
			_: unknown,
			args: { slug: string; id: string; resolved: boolean },
			ctx: GraphQLContext,
		) => {
			const user = requireUser(ctx);
			const [comment] = await db
				.select()
				.from(tables.comment)
				.where(
					and(
						eq(tables.comment.id, args.id),
						eq(tables.comment.entity_type, "note"),
						isNull(tables.comment.deleted_at),
					),
				);
			if (!comment) badInput("Comment not found");
			await requireNote(ctx, args.slug, comment.entity_id, "comment");
			await db
				.update(tables.comment)
				.set({ resolved_at: args.resolved ? new Date() : null })
				.where(eq(tables.comment.id, comment.id));
			return oneComment(comment.id, user.id);
		},
	},
};
