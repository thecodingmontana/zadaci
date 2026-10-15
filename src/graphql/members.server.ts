import { and, count, eq, isNull, max, notInArray } from "drizzle-orm";
import { db, tables } from "#/db";
import { STATUS } from "#/db/enums";

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

	extend type Workspace {
		memberStats: [MemberStats!]!
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
							notInArray(tables.project.status, DONE),
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
	},
};
