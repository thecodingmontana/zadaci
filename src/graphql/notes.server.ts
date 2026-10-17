import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { z } from "zod";
import { db, tables } from "#/db";
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
import { parse } from "./settings.server";
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
	}
`;

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

/** What the viewer may do on a page, or null when they can't see it. */
async function noteRight(workspace: Workspace, note: NoteRow) {
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
		scope &&
			or(
				workspace.role === "guest" ? undefined : isNull(tables.note.project_id),
				scope,
			),
	);
}

const noteShape = (n: NoteRow, right: ProjectRight | null) => ({
	id: n.id,
	parentId: n.parent_id,
	sortOrder: n.sort_order,
	icon: n.icon,
	title: n.title,
	projectId: n.project_id,
	excerpt: (n.content ?? "").replace(/\s+/g, " ").slice(0, 160),
	createdBy: n.created_by,
	updatedBy: n.updated_by,
	createdAt: n.created_at.toISOString(),
	updatedAt: n.updated_at.toISOString(),
	canEdit: hasRight(right, "edit"),
	canDelete: hasRight(right, "full"),
});

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

/** Ids of a page and every live page under it. */
async function subtree(id: string) {
	const result = await db.execute<{ id: string }>(sql`
		with recursive t as (
			select id from ${tables.note} where id = ${id}
			union all
			select n.id from ${tables.note} n join t on n.parent_id = t.id
			where n.deleted_at is null
		)
		select id from t
	`);
	return [...result].map((r) => r.id);
}

async function oneNote(id: string, workspace: Workspace) {
	const [note] = await db
		.select()
		.from(tables.note)
		.where(eq(tables.note.id, id));
	if (!note) badInput("Note not found");
	return noteShape(note, await noteRight(workspace, note));
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
			const { workspace } = await workspaceOf(ctx, args.slug);
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
						.where(inArray(tables.project.id, projectIds))
				: [];
			const rights = new Map(
				await Promise.all(
					projects.map(
						async (p) => [p.id, await viewerRight(workspace, p)] as const,
					),
				),
			);
			return rows.map((n) =>
				noteShape(
					n,
					n.project_id && rights.has(n.project_id)
						? (rights.get(n.project_id) ?? null)
						: unlinkedRight(workspace, n),
				),
			);
		},
		note: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const { note, right } = await requireNote(ctx, args.slug, args.id);
			return { ...noteShape(note, right), doc: note.doc };
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
			let workspace: Workspace;
			if (parentId) {
				// a sub-page lives under its parent's sharing
				const parent = await requireNote(ctx, args.slug, parentId, "edit");
				workspace = parent.workspace;
				projectId = parent.note.project_id;
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
					title,
					icon,
					sort_order: (await lastSibling(workspace.id, parentId)) + 1,
					created_by: workspace.memberId ?? "",
					updated_by: workspace.memberId ?? null,
				})
				.returning({ id: tables.note.id });
			if (!row) throw new Error("Note insert returned nothing");
			return oneNote(row.id, workspace);
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
				};
				baseUpdatedAt?: string | null;
			},
			ctx: GraphQLContext,
		) => {
			const { workspace, note } = await requireNote(
				ctx,
				args.slug,
				args.id,
				"edit",
			);
			const { patch } = args;
			// someone else saved since this editor loaded the page: don't overwrite their work
			if (
				args.baseUpdatedAt &&
				note.updated_by !== workspace.memberId &&
				note.updated_at.getTime() > new Date(args.baseUpdatedAt).getTime()
			)
				throw new GraphQLError("Someone else changed this note", {
					extensions: { code: "CONFLICT" },
				});
			const set: Partial<typeof tables.note.$inferInsert> = {
				updated_by: workspace.memberId ?? null,
			};
			if (patch.title != null) set.title = parse(TITLE, patch.title);
			if (patch.icon !== undefined) set.icon = parse(ICON, patch.icon);
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
			if (patch.projectId !== undefined) {
				if (note.parent_id)
					badInput("Sub-pages follow their parent page's project");
				if (patch.projectId) await checkProject(workspace, patch.projectId);
				canOwnTopLevel(workspace, patch.projectId);
				set.project_id = patch.projectId;
			}
			const below =
				set.project_id !== undefined ? await subtree(note.id) : [note.id];
			await db.transaction(async (tx) => {
				await tx
					.update(tables.note)
					.set(set)
					.where(eq(tables.note.id, note.id));
				// sub-pages follow their parent's sharing
				if (below.length > 1)
					await tx
						.update(tables.note)
						.set({ project_id: set.project_id })
						.where(inArray(tables.note.id, below));
			});
			return oneNote(note.id, workspace);
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
			const { workspace, note } = await requireNote(
				ctx,
				args.slug,
				args.id,
				"edit",
			);
			if (!Number.isFinite(args.sortOrder)) badInput("Bad position");
			const parentId = args.parentId ?? null;
			const ids = await subtree(note.id);
			let projectId = note.project_id;
			if (parentId) {
				if (ids.includes(parentId)) badInput("A page can't go inside itself");
				const parent = await requireNote(ctx, args.slug, parentId, "edit");
				projectId = parent.note.project_id;
			} else canOwnTopLevel(workspace, projectId);
			await db.transaction(async (tx) => {
				await tx
					.update(tables.note)
					.set({
						parent_id: parentId,
						sort_order: args.sortOrder,
						updated_by: workspace.memberId ?? null,
					})
					.where(eq(tables.note.id, note.id));
				if (projectId !== note.project_id)
					await tx
						.update(tables.note)
						.set({ project_id: projectId })
						.where(inArray(tables.note.id, ids));
			});
			return oneNote(note.id, workspace);
		},

		duplicateNote: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const { workspace, note } = await requireNote(ctx, args.slug, args.id);
			if (note.parent_id)
				await requireNote(ctx, args.slug, note.parent_id, "edit");
			else canOwnTopLevel(workspace, note.project_id);
			const [row] = await db
				.insert(tables.note)
				.values({
					workspace_id: workspace.id,
					parent_id: note.parent_id,
					project_id: note.project_id,
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
			return oneNote(row.id, workspace);
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
