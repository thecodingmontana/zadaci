import {
	and,
	asc,
	count,
	eq,
	isNull,
	lt,
	max,
	min,
	notInArray,
} from "drizzle-orm";
import { z } from "zod";
import { db, tables } from "#/db";
import { PRIORITY, PROJECT_STATUS, STATUS } from "#/db/enums";
import { PCOLORS } from "#/lib/onboarding";
import {
	ALL_PROJECT_ICONS,
	fromDay,
	makeKey,
	PROJECT_TEMPLATES,
	PSTAT,
	toDay,
} from "#/lib/projects";
import { logActivity } from "./activity.server";
import { requireProject } from "./projects.server";
import {
	badInput,
	forbidden,
	type GraphQLContext,
	projectScope,
} from "./schema.server";
import { parse, requireWorkspace } from "./settings.server";

// Projects page and project page: create and edit projects, milestones, and the numbers
// shown on project cards and the overview (reference projects.js / project-overview.js).

type Project = typeof tables.project.$inferSelect;

export const projectDetailsTypeDefs = /* GraphQL */ `
	type Milestone {
		id: ID!
		name: String!
		"YYYY-MM-DD"
		date: String!
	}

	type StatusCount {
		status: String!
		count: Int!
	}

	type ProjectStats {
		projectId: ID!
		total: Int!
		done: Int!
		overdue: Int!
		statusCounts: [StatusCount!]!
		memberIds: [ID!]!
		lastActivityAt: String
	}

	input ProjectInput {
		title: String!
		description: String
		icon: String!
		color: String!
		teamId: ID
		leadId: ID
		dueDate: String
		template: String
	}

	input ProjectPatch {
		title: String
		description: String
		icon: String
		color: String
		teamId: ID
		leadId: ID
		startDate: String
		dueDate: String
		status: String
	}

	extend type Project {
		key: String!
		"YYYY-MM-DD"
		startDate: String
		"YYYY-MM-DD"
		dueDate: String
		milestones: [Milestone!]!
	}

	extend type Task {
		"YYYY-MM-DD"
		dueDate: String
	}

	extend type Workspace {
		projectStats: [ProjectStats!]!
	}

	extend type Mutation {
		createProject(slug: String!, input: ProjectInput!): Project!
		updateProject(slug: String!, projectId: ID!, input: ProjectPatch!): Project!
		addMilestone(
			slug: String!
			projectId: ID!
			name: String!
			date: String!
		): Milestone!
		deleteMilestone(slug: String!, projectId: ID!, id: ID!): Boolean!
	}
`;

const DAY = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-31");
const fields = {
	title: z.string().trim().min(1, "Give the project a name").max(255),
	description: z.string().trim().max(5000).nullish(),
	icon: z.enum(ALL_PROJECT_ICONS as [string, ...string[]], {
		message: "Pick an icon",
	}),
	color: z.enum(Object.keys(PCOLORS) as [string, ...string[]], {
		message: "Pick a color",
	}),
	teamId: z.string().nullish(),
	leadId: z.string().nullish(),
	dueDate: DAY.nullish(),
};
const projectInput = z.object({
	...fields,
	template: z.string().nullish(),
});
const projectPatch = z
	.object({
		...fields,
		startDate: DAY.nullish(),
		status: z.enum(Object.keys(PSTAT) as [string, ...string[]]).nullish(),
	})
	.partial();

const DONE = [STATUS.COMPLETED, STATUS.ABANDONED];
const addDays = (days: number) => {
	const d = new Date();
	d.setUTCHours(0, 0, 0, 0);
	d.setUTCDate(d.getUTCDate() + days);
	return d;
};

/** A team and lead must belong to this workspace. */
async function checkRefs(
	workspaceId: string,
	refs: { teamId?: string | null; leadId?: string | null },
) {
	if (refs.teamId) {
		const [team] = await db
			.select({ id: tables.team.id })
			.from(tables.team)
			.where(
				and(
					eq(tables.team.id, refs.teamId),
					eq(tables.team.workspace_id, workspaceId),
					isNull(tables.team.deleted_at),
				),
			);
		if (!team) badInput("That team doesn't exist anymore");
	}
	if (refs.leadId) {
		const [lead] = await db
			.select({ id: tables.workspace_members.id })
			.from(tables.workspace_members)
			.where(
				and(
					eq(tables.workspace_members.id, refs.leadId),
					eq(tables.workspace_members.workspace_id, workspaceId),
					isNull(tables.workspace_members.deleted_at),
				),
			);
		if (!lead) badInput("The lead must be someone in this workspace");
	}
}

export const projectDetailsResolvers = {
	Project: {
		startDate: (p: Project) => toDay(p.start_date),
		dueDate: (p: Project) => toDay(p.due_date),
		milestones: (p: Project) =>
			db
				.select()
				.from(tables.project_milestone)
				.where(
					and(
						eq(tables.project_milestone.project_id, p.id),
						isNull(tables.project_milestone.deleted_at),
					),
				)
				.orderBy(asc(tables.project_milestone.date))
				.then((rows) =>
					rows.map((m) => ({ id: m.id, name: m.name, date: toDay(m.date) })),
				),
	},
	Task: {
		dueDate: (t: { due_date: Date | null }) => toDay(t.due_date),
	},
	Workspace: {
		// Card and overview numbers for every visible project, in four grouped queries.
		projectStats: async (w: {
			id: string;
			role?: string;
			memberId?: string;
		}) => {
			const visible = and(
				eq(tables.project.workspace_id, w.id),
				isNull(tables.project.deleted_at),
				projectScope(w),
			);
			const topTasks = and(
				visible,
				isNull(tables.task.deleted_at),
				isNull(tables.task.parent_task_id),
			);
			const [projects, statuses, overdue, members, activity] =
				await Promise.all([
					db
						.select({
							id: tables.project.id,
							updated: tables.project.updated_at,
						})
						.from(tables.project)
						.where(visible),
					db
						.select({
							projectId: tables.task.project_id,
							status: tables.task.status,
							n: count(),
						})
						.from(tables.task)
						.innerJoin(
							tables.project,
							eq(tables.project.id, tables.task.project_id),
						)
						.where(topTasks)
						.groupBy(tables.task.project_id, tables.task.status),
					db
						.select({ projectId: tables.task.project_id, n: count() })
						.from(tables.task)
						.innerJoin(
							tables.project,
							eq(tables.project.id, tables.task.project_id),
						)
						.where(
							and(
								topTasks,
								lt(tables.task.due_date, addDays(0)),
								notInArray(tables.task.status, DONE),
							),
						)
						.groupBy(tables.task.project_id),
					db
						.select({
							projectId: tables.project_members.project_id,
							memberId: tables.project_members.member_id,
						})
						.from(tables.project_members)
						.innerJoin(
							tables.project,
							eq(tables.project.id, tables.project_members.project_id),
						)
						.innerJoin(
							tables.workspace_members,
							eq(tables.workspace_members.id, tables.project_members.member_id),
						)
						.where(
							and(
								visible,
								isNull(tables.project_members.deleted_at),
								isNull(tables.workspace_members.deleted_at),
							),
						)
						.orderBy(asc(tables.project_members.created_at)),
					db
						.select({
							projectId: tables.activity.project_id,
							at: max(tables.activity.created_at),
						})
						.from(tables.activity)
						.where(eq(tables.activity.workspace_id, w.id))
						.groupBy(tables.activity.project_id),
				]);
			return projects.map((p) => {
				const counts = statuses.filter((s) => s.projectId === p.id);
				const last =
					activity.find((a) => a.projectId === p.id)?.at ?? p.updated;
				return {
					projectId: p.id,
					total: counts.reduce((sum, s) => sum + s.n, 0),
					done: counts.find((s) => s.status === STATUS.COMPLETED)?.n ?? 0,
					overdue: overdue.find((o) => o.projectId === p.id)?.n ?? 0,
					statusCounts: counts.map((s) => ({ status: s.status, count: s.n })),
					memberIds: members
						.filter((m) => m.projectId === p.id)
						.map((m) => m.memberId),
					lastActivityAt: last.toISOString(),
				};
			});
		},
	},
	Mutation: {
		createProject: async (
			_: unknown,
			args: { slug: string; input: unknown },
			ctx: GraphQLContext,
		) => {
			const { user, workspace } = await requireWorkspace(
				ctx,
				args.slug,
				"createProjects",
			);
			const input = parse(projectInput, args.input);
			const template = PROJECT_TEMPLATES.find(
				(t) => t.id === (input.template ?? "blank"),
			);
			if (!template) badInput("Pick a template");
			const me = workspace.memberId ?? "";
			const leadId = input.leadId || me;
			await checkRefs(workspace.id, { teamId: input.teamId, leadId });

			const project = await db.transaction(async (tx) => {
				const siblings = await tx
					.select({
						key: tables.project.key,
						first: min(tables.project.sort_order),
					})
					.from(tables.project)
					.where(
						and(
							eq(tables.project.workspace_id, workspace.id),
							isNull(tables.project.deleted_at),
						),
					)
					.groupBy(tables.project.key);
				const first = Math.min(0, ...siblings.map((s) => s.first ?? 0));
				const [project] = await tx
					.insert(tables.project)
					.values({
						workspace_id: workspace.id,
						title: input.title,
						description: input.description || null,
						icon: input.icon,
						color: input.color,
						team_id: input.teamId || null,
						lead_id: leadId,
						key: makeKey(
							input.title,
							siblings.map((s) => s.key),
						),
						status: PROJECT_STATUS.PLANNING,
						start_date: addDays(0),
						due_date: input.dueDate ? fromDay(input.dueDate) : addDays(30),
						// new projects go to the top of the sidebar, like the reference
						sort_order: first - 1,
					})
					.returning();
				if (!project) throw new Error("Project insert returned nothing");
				await tx.insert(tables.project_members).values(
					[...new Set([me, leadId])].map((member_id) => ({
						project_id: project.id,
						member_id,
					})),
				);
				// Starter tasks: the first is yours and urgent-ish, the rest wait in the backlog.
				for (const [i, name] of template.tasks.entries()) {
					const [task] = await tx
						.insert(tables.task)
						.values({
							name,
							project_id: project.id,
							status: i === 0 ? STATUS.TODO : STATUS.IDEA,
							priority: i === 0 ? PRIORITY.HIGH : PRIORITY.MEDIUM,
							due_date: addDays(5 + i * 5),
						})
						.returning({ id: tables.task.id });
					if (i === 0 && task)
						await tx.insert(tables.task_assignees).values({
							task_id: task.id,
							member_id: me,
							assigned_at: new Date(),
						});
				}
				await logActivity(tx, {
					workspace_id: workspace.id,
					actor_id: user.id,
					kind: "project",
					verb: "created project",
					target: project.title,
					project_id: project.id,
				});
				return project;
			});
			return { ...project, myAccess: "full" };
		},

		updateProject: async (
			_: unknown,
			args: { slug: string; projectId: string; input: unknown },
			ctx: GraphQLContext,
		) => {
			const { user, workspace, project, right } = await requireProject(
				ctx,
				args.slug,
				args.projectId,
				{ right: "edit" },
			);
			const patch = parse(projectPatch, args.input);
			const leadChanges =
				patch.leadId !== undefined && patch.leadId !== project.lead_id;
			// changing who leads a project is a sharing decision
			if (leadChanges && right !== "full") forbidden();
			await checkRefs(workspace.id, patch);
			const [updated] = await db
				.update(tables.project)
				.set({
					...(patch.title !== undefined && { title: patch.title }),
					...(patch.description !== undefined && {
						description: patch.description || null,
					}),
					...(patch.icon && { icon: patch.icon }),
					...(patch.color && { color: patch.color }),
					...(patch.teamId !== undefined && { team_id: patch.teamId || null }),
					...(leadChanges && { lead_id: patch.leadId || null }),
					...(patch.startDate !== undefined && {
						start_date: patch.startDate ? fromDay(patch.startDate) : null,
					}),
					...(patch.dueDate !== undefined && {
						due_date: patch.dueDate ? fromDay(patch.dueDate) : null,
					}),
					...(patch.status && { status: patch.status as PROJECT_STATUS }),
				})
				.where(eq(tables.project.id, project.id))
				.returning();
			// the lead is always on the project
			if (leadChanges && patch.leadId)
				await db
					.insert(tables.project_members)
					.values({ project_id: project.id, member_id: patch.leadId })
					.onConflictDoNothing();
			if (patch.status && patch.status !== project.status)
				await logActivity(db, {
					workspace_id: workspace.id,
					actor_id: user.id,
					kind: "project",
					verb: "changed status of project",
					target: project.title,
					extra: `to ${PSTAT[patch.status as keyof typeof PSTAT].name}`,
					project_id: project.id,
				});
			return { ...updated, myAccess: undefined };
		},

		addMilestone: async (
			_: unknown,
			args: { slug: string; projectId: string; name: string; date: string },
			ctx: GraphQLContext,
		) => {
			const { project } = await requireProject(ctx, args.slug, args.projectId, {
				right: "edit",
			});
			const name = parse(
				z.string().trim().min(1, "Name the milestone").max(255),
				args.name,
			);
			const date = parse(DAY, args.date);
			const [milestone] = await db
				.insert(tables.project_milestone)
				.values({ project_id: project.id, name, date: fromDay(date) })
				.returning();
			if (!milestone) throw new Error("Milestone insert returned nothing");
			return { id: milestone.id, name, date };
		},

		deleteMilestone: async (
			_: unknown,
			args: { slug: string; projectId: string; id: string },
			ctx: GraphQLContext,
		) => {
			const { project } = await requireProject(ctx, args.slug, args.projectId, {
				right: "edit",
			});
			await db
				.update(tables.project_milestone)
				.set({ deleted_at: new Date() })
				.where(
					and(
						eq(tables.project_milestone.id, args.id),
						eq(tables.project_milestone.project_id, project.id),
					),
				);
			return true;
		},
	},
};
