import {
	and,
	asc,
	count,
	eq,
	getTableColumns,
	isNull,
	max,
	ne,
	notInArray,
} from "drizzle-orm";
import { db, tables } from "#/db";
import { PROJECT_STATUS, STATUS } from "#/db/enums";
import { toDay } from "#/lib/projects";
import { projectScope } from "./schema.server";

// Per-member numbers for the Members directory, fetched in four grouped queries
// rather than one query per member.

export const membersTypeDefs = /* GraphQL */ `
	type MemberStats {
		memberId: ID!
		teamIds: [ID!]!
		activeProjects: Int!
		openTasks: Int!
		lastActiveAt: String
	}

	type ProfileTask {
		id: ID!
		name: String!
		status: String!
		priority: String!
		dueDate: String
		projectId: ID!
		projectTitle: String!
		projectColor: String
	}

	type MemberProfile {
		projects: [Project!]!
		tasks: [ProfileTask!]!
	}

	extend type Workspace {
		memberStats: [MemberStats!]!
		memberProfile(memberId: ID!): MemberProfile!
	}
`;

const DONE = [STATUS.COMPLETED, STATUS.ABANDONED];

export const membersResolvers = {
	Workspace: {
		memberStats: async (w: { id: string }) => {
			const m = tables.workspace_members;
			const [members, teams, projects, tasks] = await Promise.all([
				// last active = the newest session refresh (better-auth refreshes about daily)
				db
					.select({ id: m.id, lastActive: max(tables.session.updatedAt) })
					.from(m)
					.leftJoin(tables.session, eq(tables.session.userId, m.user_id))
					.where(and(eq(m.workspace_id, w.id), isNull(m.deleted_at)))
					.groupBy(m.id),
				db
					.select({
						memberId: tables.team_members.member_id,
						teamId: tables.team_members.team_id,
					})
					.from(tables.team_members)
					.innerJoin(
						tables.team,
						eq(tables.team.id, tables.team_members.team_id),
					)
					.where(
						and(
							eq(tables.team.workspace_id, w.id),
							isNull(tables.team.deleted_at),
							isNull(tables.team_members.deleted_at),
						),
					),
				db
					.select({ memberId: tables.project_members.member_id, n: count() })
					.from(tables.project_members)
					.innerJoin(
						tables.project,
						eq(tables.project.id, tables.project_members.project_id),
					)
					.where(
						and(
							eq(tables.project.workspace_id, w.id),
							isNull(tables.project.deleted_at),
							isNull(tables.project.archived_at),
							isNull(tables.project_members.deleted_at),
							ne(tables.project.status, PROJECT_STATUS.COMPLETE),
						),
					)
					.groupBy(tables.project_members.member_id),
				db
					.select({ memberId: tables.task_assignees.member_id, n: count() })
					.from(tables.task_assignees)
					.innerJoin(
						tables.task,
						eq(tables.task.id, tables.task_assignees.task_id),
					)
					.innerJoin(
						tables.project,
						eq(tables.project.id, tables.task.project_id),
					)
					.where(
						and(
							eq(tables.project.workspace_id, w.id),
							isNull(tables.project.deleted_at),
							isNull(tables.task.deleted_at),
							isNull(tables.task_assignees.deleted_at),
							notInArray(tables.task.status, DONE),
						),
					)
					.groupBy(tables.task_assignees.member_id),
			]);
			const projectCount = new Map(projects.map((r) => [r.memberId, r.n]));
			const taskCount = new Map(tasks.map((r) => [r.memberId, r.n]));
			return members.map((member) => ({
				memberId: member.id,
				teamIds: teams
					.filter((t) => t.memberId === member.id)
					.map((t) => t.teamId),
				activeProjects: projectCount.get(member.id) ?? 0,
				openTasks: taskCount.get(member.id) ?? 0,
				lastActiveAt: member.lastActive?.toISOString() ?? null,
			}));
		},
		// One person's active projects and assigned tasks, for their profile page.
		memberProfile: async (
			w: { id: string; role?: string; memberId?: string; settings?: unknown },
			args: { memberId: string },
		) => {
			// only what the viewer may see (guests: their own projects)
			const liveProject = and(
				eq(tables.project.workspace_id, w.id),
				isNull(tables.project.deleted_at),
				projectScope(w),
			);
			const [projects, tasks] = await Promise.all([
				db
					.select(getTableColumns(tables.project))
					.from(tables.project_members)
					.innerJoin(
						tables.project,
						eq(tables.project.id, tables.project_members.project_id),
					)
					.where(
						and(
							liveProject,
							eq(tables.project_members.member_id, args.memberId),
							isNull(tables.project_members.deleted_at),
							isNull(tables.project.archived_at),
							ne(tables.project.status, PROJECT_STATUS.COMPLETE),
						),
					)
					.orderBy(asc(tables.project.title)),
				db
					.select({
						id: tables.task.id,
						name: tables.task.name,
						status: tables.task.status,
						priority: tables.task.priority,
						due: tables.task.due_date,
						projectId: tables.project.id,
						projectTitle: tables.project.title,
						projectColor: tables.project.color,
					})
					.from(tables.task_assignees)
					.innerJoin(
						tables.task,
						eq(tables.task.id, tables.task_assignees.task_id),
					)
					.innerJoin(
						tables.project,
						eq(tables.project.id, tables.task.project_id),
					)
					.where(
						and(
							liveProject,
							eq(tables.task_assignees.member_id, args.memberId),
							isNull(tables.task_assignees.deleted_at),
							isNull(tables.task.deleted_at),
						),
					)
					// shortcut: first 200 assigned tasks by due date; paginate once people carry more
					.orderBy(asc(tables.task.due_date))
					.limit(200),
			]);
			return {
				projects,
				tasks: tasks.map(({ due, ...t }) => ({
					...t,
					// a plain day, like every other due date (a UTC instant shows a day early in the Americas)
					dueDate: toDay(due),
				})),
			};
		},
	},
};
