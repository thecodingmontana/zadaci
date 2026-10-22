import { randomBytes } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, tables } from "#/db";
import { WS_SETTINGS_DEFAULTS } from "#/lib/preferences";
import { requireNote } from "./notes.server";
import { requireProject } from "./projects.server";
import { badInput, type GraphQLContext } from "./schema.server";

// Public, read-only links to a page or a project board. Anyone with the link can view it while
// the workspace allows public links; the owner can switch a link off at any time.

export const shareTypeDefs = /* GraphQL */ `
	type ShareLink {
		token: String!
		createdAt: String!
	}

	"a task as the public board shows it: no people, comments or files"
	type PublicTask {
		key: String!
		name: String!
		status: String!
		priority: String!
		dueDate: String
	}

	type PublicShare {
		kind: String!
		title: String!
		icon: String
		workspace: String!
		"the page's content (pages)"
		doc: JSON
		"the board's tasks (projects)"
		tasks: [PublicTask!]
	}

	extend type Query {
		"the live public link of a page or project, for people who may manage it"
		shareLink(slug: String!, kind: String!, id: ID!): ShareLink
		"what a public link shows, for anyone; null when it's off or gone"
		publicShare(token: String!): PublicShare
	}

	extend type Mutation {
		createShareLink(slug: String!, kind: String!, id: ID!): ShareLink!
		revokeShareLink(slug: String!, kind: String!, id: ID!): Boolean!
	}
`;

const publicOn = (settings: unknown) =>
	({ ...WS_SETTINGS_DEFAULTS, ...(settings as object | null) }).permPublic;

/** The workspace for a page or project the viewer has full access to (they manage its link). */
async function manage(
	ctx: GraphQLContext,
	slug: string,
	kind: string,
	id: string,
) {
	if (kind === "note") {
		const { workspace, note } = await requireNote(ctx, slug, id, "full");
		if (note.private) badInput("Private pages can't have a public link");
		return workspace;
	}
	if (kind === "project")
		return (await requireProject(ctx, slug, id, { right: "full" })).workspace;
	badInput("Only pages and projects can be shared publicly");
}

const live = (workspaceId: string, kind: string, id: string) =>
	and(
		eq(tables.share_link.workspace_id, workspaceId),
		eq(tables.share_link.entity_type, kind),
		eq(tables.share_link.entity_id, id),
		isNull(tables.share_link.revoked_at),
	);

const shape = (l: { token: string; created_at: Date }) => ({
	token: l.token,
	createdAt: l.created_at.toISOString(),
});

export const shareResolvers = {
	Query: {
		shareLink: async (
			_: unknown,
			args: { slug: string; kind: string; id: string },
			ctx: GraphQLContext,
		) => {
			const workspace = await manage(ctx, args.slug, args.kind, args.id);
			const [link] = await db
				.select()
				.from(tables.share_link)
				.where(live(workspace.id, args.kind, args.id));
			return link ? shape(link) : null;
		},

		publicShare: async (_: unknown, args: { token: string }) => {
			if (!/^[\w-]{16,32}$/.test(args.token)) return null;
			const [link] = await db
				.select({
					kind: tables.share_link.entity_type,
					id: tables.share_link.entity_id,
					workspaceId: tables.workspace.id,
					workspace: tables.workspace.name,
					settings: tables.workspace.settings,
				})
				.from(tables.share_link)
				.innerJoin(
					tables.workspace,
					eq(tables.workspace.id, tables.share_link.workspace_id),
				)
				.where(
					and(
						eq(tables.share_link.token, args.token),
						isNull(tables.share_link.revoked_at),
					),
				);
			// turning public links off in Settings stops every link at once
			if (!link || !publicOn(link.settings)) return null;
			if (link.kind === "note") {
				const [note] = await db
					.select()
					.from(tables.note)
					.where(
						and(
							eq(tables.note.id, link.id),
							eq(tables.note.workspace_id, link.workspaceId),
							isNull(tables.note.deleted_at),
							eq(tables.note.private, false),
						),
					);
				return note
					? {
							kind: "note",
							title: note.title,
							icon: note.icon,
							workspace: link.workspace,
							doc: note.doc,
							tasks: null,
						}
					: null;
			}
			const [project] = await db
				.select()
				.from(tables.project)
				.where(
					and(
						eq(tables.project.id, link.id),
						eq(tables.project.workspace_id, link.workspaceId),
						isNull(tables.project.deleted_at),
					),
				);
			if (!project) return null;
			const tasks = await db
				.select({
					number: tables.task.number,
					name: tables.task.name,
					status: tables.task.status,
					priority: tables.task.priority,
					due: tables.task.due_date,
				})
				.from(tables.task)
				.where(
					and(
						eq(tables.task.project_id, project.id),
						isNull(tables.task.deleted_at),
						isNull(tables.task.archived_at),
						isNull(tables.task.parent_task_id),
					),
				)
				.orderBy(asc(tables.task.sort_order))
				.limit(500);
			return {
				kind: "project",
				title: project.title,
				icon: project.icon,
				workspace: link.workspace,
				doc: null,
				tasks: tasks.map((t) => ({
					key: `${project.key}-${t.number}`,
					name: t.name,
					status: t.status,
					priority: t.priority,
					dueDate: t.due ? t.due.toISOString().slice(0, 10) : null,
				})),
			};
		},
	},

	Mutation: {
		createShareLink: async (
			_: unknown,
			args: { slug: string; kind: string; id: string },
			ctx: GraphQLContext,
		) => {
			const workspace = await manage(ctx, args.slug, args.kind, args.id);
			if (!publicOn(workspace.settings))
				badInput(
					"Public links are off for this workspace. An admin can turn them on in Settings → Permissions.",
				);
			const [existing] = await db
				.select()
				.from(tables.share_link)
				.where(live(workspace.id, args.kind, args.id));
			if (existing) return shape(existing);
			const [link] = await db
				.insert(tables.share_link)
				.values({
					workspace_id: workspace.id,
					entity_type: args.kind,
					entity_id: args.id,
					// 128 random bits: unguessable, and short enough for a URL
					token: randomBytes(16).toString("base64url"),
					created_by: workspace.memberId ?? "",
				})
				.returning();
			if (!link) throw new Error("Share link insert returned nothing");
			return shape(link);
		},

		revokeShareLink: async (
			_: unknown,
			args: { slug: string; kind: string; id: string },
			ctx: GraphQLContext,
		) => {
			const workspace = await manage(ctx, args.slug, args.kind, args.id);
			await db
				.update(tables.share_link)
				.set({ revoked_at: new Date() })
				.where(live(workspace.id, args.kind, args.id));
			return true;
		},
	},
};
