import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { z } from "zod";
import { db, tables } from "#/db";
import {
	can,
	hasRight,
	type Permission,
	type ProjectRight,
	projectRight,
} from "#/lib/permissions";
import { makeKey } from "#/lib/projects";
import { logActivity, notify, projectUserIds } from "./activity.server";
import {
	badInput,
	findWorkspaces,
	forbidden,
	type GraphQLContext,
	projectScope,
	requireUser,
} from "./schema.server";

// Project actions from the sidebar "…" menu (ported from the reference app's project context menu).

type Project = typeof tables.project.$inferSelect;

export const projectsTypeDefs = /* GraphQL */ `
	extend type Project {
		isFavorite: Boolean!
		archivedAt: String
		teamId: ID
		"workspace (everyone can view and comment) or private (invited people only)"
		access: String!
		leadId: ID
		"the viewer's right here: view, comment, edit or full"
		myAccess: String
	}

	extend type Workspace {
		archivedProjects: [Project!]!
	}

	extend type Mutation {
		toggleFavorite(slug: String!, projectId: ID!): Boolean!
		renameProject(slug: String!, projectId: ID!, title: String!): Project!
		duplicateProject(slug: String!, projectId: ID!): Project!
		moveProject(slug: String!, projectId: ID!, direction: String!): Boolean!
		archiveProject(slug: String!, projectId: ID!, archived: Boolean!): Project!
		deleteProject(slug: String!, projectId: ID!): Boolean!
	}
`;

/** The viewer's right on one project (null when they can't see it). */
export async function viewerRight(
	workspace: { role?: string; memberId?: string },
	project: Project,
) {
	const [row] = await db
		.select({ permission: tables.project_members.permission })
		.from(tables.project_members)
		.where(
			and(
				eq(tables.project_members.project_id, project.id),
				eq(tables.project_members.member_id, workspace.memberId ?? ""),
				isNull(tables.project_members.deleted_at),
			),
		);
	return projectRight(
		workspace.role,
		{ access: project.access, isLead: project.lead_id === workspace.memberId },
		row ? row.permission : undefined,
	);
}

/** Who can see one project, as a test on any workspace member (for notifications and assignees). */
export async function projectAudience(projectId: string) {
	const [[project], rows] = await Promise.all([
		db
			.select({ access: tables.project.access, leadId: tables.project.lead_id })
			.from(tables.project)
			.where(eq(tables.project.id, projectId)),
		db
			.select({
				memberId: tables.project_members.member_id,
				permission: tables.project_members.permission,
			})
			.from(tables.project_members)
			.where(
				and(
					eq(tables.project_members.project_id, projectId),
					isNull(tables.project_members.deleted_at),
				),
			),
	]);
	const on = new Map(rows.map((r) => [r.memberId, r.permission]));
	return (m: { memberId: string; role: string }) =>
		!!project &&
		projectRight(
			m.role,
			{ access: project.access, isLead: project.leadId === m.memberId },
			on.has(m.memberId) ? on.get(m.memberId) : undefined,
		) !== null;
}

/**
 * A project the viewer can see, failing like a missing project when they can't.
 * `need` checks a workspace permission and/or the viewer's right on the project.
 */
export async function requireProject(
	ctx: GraphQLContext,
	slug: string,
	projectId: string,
	need: { permission?: Permission; right?: ProjectRight } = {},
) {
	const user = requireUser(ctx);
	const [workspace] = await findWorkspaces(user.id, slug);
	if (!workspace)
		throw new GraphQLError("Workspace not found", {
			extensions: { code: "NOT_FOUND" },
		});
	const [project] = await db
		.select()
		.from(tables.project)
		.where(
			and(
				eq(tables.project.id, projectId),
				eq(tables.project.workspace_id, workspace.id),
				isNull(tables.project.deleted_at),
				projectScope(workspace),
			),
		);
	if (!project) badInput("Project not found");
	if (
		need.permission &&
		!can(workspace.role, need.permission, workspace.settings as object)
	)
		forbidden();
	const right = await viewerRight(workspace, project);
	if (need.right && !hasRight(right, need.right)) forbidden();
	return { user, workspace, project, right };
}

const visibleProjects = (workspaceId: string) =>
	db
		.select({ id: tables.project.id })
		.from(tables.project)
		.where(
			and(
				eq(tables.project.workspace_id, workspaceId),
				isNull(tables.project.deleted_at),
				isNull(tables.project.archived_at),
			),
		)
		.orderBy(asc(tables.project.sort_order), asc(tables.project.created_at));

const projectActivity = (
	workspaceId: string,
	actorId: string,
	project: Project,
	verb: string,
	extra?: string,
) =>
	logActivity(db, {
		workspace_id: workspaceId,
		actor_id: actorId,
		kind: "project",
		verb,
		target: project.title,
		extra,
		project_id: project.id,
	});

/** Tell the project's other members; a deleted project keeps its name in the snippet. */
async function notifyProject(
	workspaceId: string,
	actorId: string,
	project: Project,
	text: string,
	snippet?: string,
) {
	const users = await projectUserIds(db, project.id);
	await notify(
		db,
		users
			.filter((id) => id !== actorId)
			.map((id) => ({
				user_id: id,
				workspace_id: workspaceId,
				actor_id: actorId,
				type: "update",
				text,
				snippet,
				project_id: project.id,
			})),
	);
}

export const projectsResolvers = {
	Project: {
		isFavorite: async (
			p: Project & { isFavorite?: boolean },
			_: unknown,
			ctx: GraphQLContext,
		) => {
			if (typeof p.isFavorite === "boolean") return p.isFavorite; // already joined by Workspace.projects
			if (!ctx.user) return false;
			const [row] = await db
				.select({ id: tables.favorite.id })
				.from(tables.favorite)
				.where(
					and(
						eq(tables.favorite.user_id, ctx.user.id),
						eq(tables.favorite.entity_type, "project"),
						eq(tables.favorite.entity_id, p.id),
					),
				);
			return !!row;
		},
		archivedAt: (p: Project) => p.archived_at?.toISOString() ?? null,
		teamId: (p: Project) => p.team_id,
		leadId: (p: Project) => p.lead_id,
		// precomputed by Workspace.projects; looked up for projects returned elsewhere
		myAccess: async (
			p: Project & { myAccess?: string | null },
			_: unknown,
			ctx: GraphQLContext,
		) => {
			if (p.myAccess !== undefined) return p.myAccess;
			if (!ctx.user) return null;
			const [member] = await db
				.select({
					role: tables.workspace_members.role,
					memberId: tables.workspace_members.id,
				})
				.from(tables.workspace_members)
				.where(
					and(
						eq(tables.workspace_members.workspace_id, p.workspace_id),
						eq(tables.workspace_members.user_id, ctx.user.id),
						isNull(tables.workspace_members.deleted_at),
					),
				);
			return member ? viewerRight(member, p) : null;
		},
	},
	Workspace: {
		archivedProjects: (w: { id: string; role?: string; memberId?: string }) =>
			db
				.select()
				.from(tables.project)
				.where(
					and(
						eq(tables.project.workspace_id, w.id),
						isNull(tables.project.deleted_at),
						isNotNull(tables.project.archived_at),
						projectScope(w),
					),
				)
				.orderBy(asc(tables.project.title)),
	},
	Mutation: {
		toggleFavorite: async (
			_: unknown,
			args: { slug: string; projectId: string },
			ctx: GraphQLContext,
		) => {
			const { user, workspace, project } = await requireProject(
				ctx,
				args.slug,
				args.projectId,
			);
			const where = and(
				eq(tables.favorite.user_id, user.id),
				eq(tables.favorite.entity_type, "project"),
				eq(tables.favorite.entity_id, project.id),
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
					entity_type: "project",
					entity_id: project.id,
				})
				// a double click: the first insert won, which is the same result
				.onConflictDoNothing();
			return true;
		},

		renameProject: async (
			_: unknown,
			args: { slug: string; projectId: string; title: string },
			ctx: GraphQLContext,
		) => {
			const { user, workspace, project } = await requireProject(
				ctx,
				args.slug,
				args.projectId,
				{ right: "edit" },
			);
			const title = z
				.string()
				.trim()
				.min(1, "Give the project a name")
				.max(255)
				.safeParse(args.title);
			if (!title.success)
				badInput(title.error.issues[0]?.message ?? "Invalid name");
			const [updated] = await db
				.update(tables.project)
				.set({ title: title.data })
				.where(eq(tables.project.id, project.id))
				.returning();
			if (title.data !== project.title)
				await projectActivity(
					workspace.id,
					user.id,
					project,
					"renamed project",
					`to “${title.data}”`,
				);
			return updated;
		},

		duplicateProject: async (
			_: unknown,
			args: { slug: string; projectId: string },
			ctx: GraphQLContext,
		) => {
			const { user, workspace, project } = await requireProject(
				ctx,
				args.slug,
				args.projectId,
				{ permission: "createProjects", right: "edit" },
			);
			// A duplicate is a new project, so it follows "Members can create projects", and
			// copying everything in it needs edit rights there (the copier leads the copy).
			const copy = await db.transaction(async (tx) => {
				const { id: _id, created_at: _c, updated_at: _u, ...rest } = project;
				// the copy needs its own key, or its tasks read WR-1, WR-2 like the original's
				const taken = await tx
					.select({ key: tables.project.key })
					.from(tables.project)
					.where(
						and(
							eq(tables.project.workspace_id, workspace.id),
							isNull(tables.project.deleted_at),
						),
					);
				const title = `${project.title} (copy)`;
				const [copy] = await tx
					.insert(tables.project)
					.values({
						...rest,
						title,
						key: makeKey(
							title,
							taken.map((t) => t.key),
						),
						sort_order: project.sort_order + 1,
						// whoever duplicates it leads the copy
						lead_id: workspace.memberId ?? null,
					})
					.returning();
				if (!copy) throw new Error("Project insert returned nothing");
				const tasks = await tx
					.select()
					.from(tables.task)
					.where(
						and(
							eq(tables.task.project_id, project.id),
							isNull(tables.task.deleted_at),
						),
					)
					.orderBy(asc(tables.task.created_at));
				// Parents first so subtasks can point at their copied parent.
				const ids = new Map<string, string>();
				for (const t of [
					...tasks.filter((t) => !t.parent_task_id),
					...tasks.filter((t) => t.parent_task_id),
				]) {
					const { id, created_at: _tc, updated_at: _tu, ...task } = t;
					const [row] = await tx
						.insert(tables.task)
						.values({
							...task,
							project_id: copy.id,
							parent_task_id: t.parent_task_id
								? (ids.get(t.parent_task_id) ?? null)
								: null,
						})
						.returning({ id: tables.task.id });
					if (row) ids.set(id, row.id);
				}
				const members = await tx
					.select({
						member_id: tables.project_members.member_id,
						permission: tables.project_members.permission,
					})
					.from(tables.project_members)
					.where(
						and(
							eq(tables.project_members.project_id, project.id),
							isNull(tables.project_members.deleted_at),
						),
					);
				if (
					workspace.memberId &&
					!members.some((m) => m.member_id === workspace.memberId)
				)
					members.push({ member_id: workspace.memberId, permission: null });
				await tx.insert(tables.project_members).values(
					members.map((m) => ({
						project_id: copy.id,
						member_id: m.member_id,
						permission: m.permission,
					})),
				);
				return copy;
			});
			await projectActivity(
				workspace.id,
				user.id,
				project,
				"duplicated project",
				`as “${copy.title}”`,
			);
			return copy;
		},

		moveProject: async (
			_: unknown,
			args: { slug: string; projectId: string; direction: string },
			ctx: GraphQLContext,
		) => {
			const { workspace, project } = await requireProject(
				ctx,
				args.slug,
				args.projectId,
				{ permission: "editProjects" },
			);
			if (args.direction !== "up" && args.direction !== "down")
				badInput("Direction must be up or down");
			const order = (await visibleProjects(workspace.id)).map((p) => p.id);
			const i = order.indexOf(project.id);
			const j = args.direction === "up" ? i - 1 : i + 1;
			if (i < 0 || j < 0 || j >= order.length) return false;
			[order[i], order[j]] = [order[j] as string, order[i] as string];
			await db.transaction(async (tx) => {
				for (const [index, id] of order.entries()) {
					await tx
						.update(tables.project)
						.set({ sort_order: index })
						.where(eq(tables.project.id, id));
				}
			});
			return true;
		},

		archiveProject: async (
			_: unknown,
			args: { slug: string; projectId: string; archived: boolean },
			ctx: GraphQLContext,
		) => {
			const { user, workspace, project } = await requireProject(
				ctx,
				args.slug,
				args.projectId,
				{ right: "edit" },
			);
			const [updated] = await db
				.update(tables.project)
				.set({ archived_at: args.archived ? new Date() : null })
				.where(eq(tables.project.id, project.id))
				.returning();
			if (args.archived !== !!project.archived_at) {
				const verb = args.archived ? "archived" : "restored";
				await projectActivity(
					workspace.id,
					user.id,
					project,
					`${verb} project`,
				);
				await notifyProject(
					workspace.id,
					user.id,
					project,
					`${verb} the project`,
				);
			}
			return updated;
		},

		deleteProject: async (
			_: unknown,
			args: { slug: string; projectId: string },
			ctx: GraphQLContext,
		) => {
			const { user, workspace, project } = await requireProject(
				ctx,
				args.slug,
				args.projectId,
				{ permission: "deleteProjects" },
			);
			await db.transaction(async (tx) => {
				const now = new Date();
				await tx
					.update(tables.project)
					.set({ deleted_at: now })
					.where(eq(tables.project.id, project.id));
				await tx
					.update(tables.task)
					.set({ deleted_at: now })
					.where(eq(tables.task.project_id, project.id));
				await tx
					.delete(tables.favorite)
					.where(
						and(
							eq(tables.favorite.entity_type, "project"),
							inArray(tables.favorite.entity_id, [project.id]),
						),
					);
			});
			await projectActivity(workspace.id, user.id, project, "deleted project");
			await notifyProject(
				workspace.id,
				user.id,
				project,
				"deleted the project",
				project.title,
			);
			return true;
		},
	},
};
