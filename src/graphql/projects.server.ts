import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { z } from "zod";
import { db, tables } from "#/db";
import { USER_ROLE } from "#/db/enums";
import { WS_SETTINGS_DEFAULTS } from "#/lib/preferences";
import {
	badInput,
	findWorkspaces,
	type GraphQLContext,
	requireUser,
} from "./schema.server";

// Project actions from the sidebar "…" menu (ported from the reference app's project context menu).

type Project = typeof tables.project.$inferSelect;

export const projectsTypeDefs = /* GraphQL */ `
	extend type Project {
		isFavorite: Boolean!
		archivedAt: String
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

async function requireProject(
	ctx: GraphQLContext,
	slug: string,
	projectId: string,
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
			),
		);
	if (!project) badInput("Project not found");
	return { user, workspace, project };
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

export const projectsResolvers = {
	Project: {
		isFavorite: async (p: Project, _: unknown, ctx: GraphQLContext) => {
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
	},
	Workspace: {
		archivedProjects: (w: { id: string }) =>
			db
				.select()
				.from(tables.project)
				.where(
					and(
						eq(tables.project.workspace_id, w.id),
						isNull(tables.project.deleted_at),
						isNotNull(tables.project.archived_at),
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
			await db.insert(tables.favorite).values({
				user_id: user.id,
				workspace_id: workspace.id,
				entity_type: "project",
				entity_id: project.id,
			});
			return true;
		},

		renameProject: async (
			_: unknown,
			args: { slug: string; projectId: string; title: string },
			ctx: GraphQLContext,
		) => {
			const { project } = await requireProject(ctx, args.slug, args.projectId);
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
			return updated;
		},

		duplicateProject: async (
			_: unknown,
			args: { slug: string; projectId: string },
			ctx: GraphQLContext,
		) => {
			const { workspace, project } = await requireProject(
				ctx,
				args.slug,
				args.projectId,
			);
			// A duplicate is a new project, so it follows "Members can create projects".
			const { permCreate } = {
				...WS_SETTINGS_DEFAULTS,
				...(workspace.settings as object),
			};
			if (
				!permCreate &&
				![USER_ROLE.OWNER, USER_ROLE.MODERATOR].includes(
					workspace.role as USER_ROLE,
				)
			) {
				throw new GraphQLError(
					"Only owners and admins can create projects in this workspace",
					{
						extensions: { code: "FORBIDDEN" },
					},
				);
			}
			return db.transaction(async (tx) => {
				const { id: _id, created_at: _c, updated_at: _u, ...rest } = project;
				const [copy] = await tx
					.insert(tables.project)
					.values({
						...rest,
						title: `${project.title} (copy)`,
						sort_order: project.sort_order + 1,
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
					.select({ member_id: tables.project_members.member_id })
					.from(tables.project_members)
					.where(
						and(
							eq(tables.project_members.project_id, project.id),
							isNull(tables.project_members.deleted_at),
						),
					);
				if (members.length) {
					await tx.insert(tables.project_members).values(
						members.map((m) => ({
							project_id: copy.id,
							member_id: m.member_id,
						})),
					);
				}
				return copy;
			});
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
			const { project } = await requireProject(ctx, args.slug, args.projectId);
			const [updated] = await db
				.update(tables.project)
				.set({ archived_at: args.archived ? new Date() : null })
				.where(eq(tables.project.id, project.id))
				.returning();
			return updated;
		},

		deleteProject: async (
			_: unknown,
			args: { slug: string; projectId: string },
			ctx: GraphQLContext,
		) => {
			const { workspace, project } = await requireProject(
				ctx,
				args.slug,
				args.projectId,
			);
			if (
				![USER_ROLE.OWNER, USER_ROLE.MODERATOR].includes(
					workspace.role as USER_ROLE,
				)
			) {
				throw new GraphQLError("Only owners and admins can delete projects", {
					extensions: { code: "FORBIDDEN" },
				});
			}
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
			return true;
		},
	},
};
