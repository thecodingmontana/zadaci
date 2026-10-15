import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, tables } from "#/db";
import { PCOLORS, TEAM_ICONS } from "#/lib/onboarding";
import { logActivity } from "./activity.server";
import type { GraphQLContext } from "./schema.server";
import { badInput } from "./schema.server";
import { parse, requireWorkspace } from "./settings.server";

// Teams: create, edit (with members), delete. Ported from the reference app's team modal,
// where everyone has one primary team, so adding someone moves them from their old team.

export const teamsTypeDefs = /* GraphQL */ `
	input TeamInput {
		name: String!
		description: String
		icon: String!
		color: String!
		memberIds: [ID!]!
	}

	extend type Mutation {
		createTeam(slug: String!, input: TeamInput!): Team!
		updateTeam(slug: String!, id: ID!, input: TeamInput!): Team!
		deleteTeam(slug: String!, id: ID!): Boolean!
	}
`;

const teamInput = z.object({
	name: z.string().trim().min(1, "Give the team a name").max(255),
	description: z.string().trim().max(500).nullish(),
	icon: z.enum(TEAM_ICONS.map(([icon]) => icon) as [string, ...string[]]),
	color: z.enum(Object.keys(PCOLORS) as [string, ...string[]]),
	memberIds: z.array(z.string()).max(500),
});

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function checkName(workspaceId: string, name: string, exceptId?: string) {
	const [taken] = await db
		.select({ id: tables.team.id })
		.from(tables.team)
		.where(
			and(
				eq(tables.team.workspace_id, workspaceId),
				isNull(tables.team.deleted_at),
				sql`lower(${tables.team.name}) = ${name.toLowerCase()}`,
				exceptId ? ne(tables.team.id, exceptId) : undefined,
			),
		);
	if (taken) badInput(`A team called “${name}” already exists`);
}

/** Makes `memberIds` exactly this team's members, moving them out of any other team. */
async function setMembers(
	tx: Tx,
	workspaceId: string,
	teamId: string,
	memberIds: string[],
) {
	const ids = [...new Set(memberIds)];
	const valid = ids.length
		? await tx
				.select({ id: tables.workspace_members.id })
				.from(tables.workspace_members)
				.where(
					and(
						eq(tables.workspace_members.workspace_id, workspaceId),
						isNull(tables.workspace_members.deleted_at),
						inArray(tables.workspace_members.id, ids),
					),
				)
		: [];
	if (valid.length !== ids.length)
		badInput("Some of those people aren't in this workspace");
	const now = new Date();
	const workspaceTeams = tx
		.select({ id: tables.team.id })
		.from(tables.team)
		.where(eq(tables.team.workspace_id, workspaceId));
	// drop everyone from this team, and the chosen people from every other team
	await tx
		.update(tables.team_members)
		.set({ deleted_at: now })
		.where(
			and(
				isNull(tables.team_members.deleted_at),
				inArray(tables.team_members.team_id, workspaceTeams),
				or(
					eq(tables.team_members.team_id, teamId),
					ids.length ? inArray(tables.team_members.member_id, ids) : undefined,
				),
			),
		);
	if (ids.length)
		await tx
			.insert(tables.team_members)
			.values(ids.map((member_id) => ({ team_id: teamId, member_id })));
}

async function requireTeam(workspaceId: string, id: string) {
	const [team] = await db
		.select()
		.from(tables.team)
		.where(
			and(
				eq(tables.team.id, id),
				eq(tables.team.workspace_id, workspaceId),
				isNull(tables.team.deleted_at),
			),
		);
	if (!team) badInput("Team not found");
	return team;
}

export const teamsResolvers = {
	Mutation: {
		createTeam: async (
			_: unknown,
			args: { slug: string; input: unknown },
			ctx: GraphQLContext,
		) => {
			const { user, workspace } = await requireWorkspace(
				ctx,
				args.slug,
				"manageTeams",
			);
			const input = parse(teamInput, args.input);
			await checkName(workspace.id, input.name);
			const team = await db.transaction(async (tx) => {
				const [team] = await tx
					.insert(tables.team)
					.values({
						workspace_id: workspace.id,
						name: input.name,
						description: input.description || null,
						icon: input.icon,
						color: input.color,
					})
					.returning();
				if (!team) throw new Error("Team insert returned nothing");
				await setMembers(tx, workspace.id, team.id, input.memberIds);
				await logActivity(tx, {
					workspace_id: workspace.id,
					actor_id: user.id,
					kind: "team",
					verb: "created team",
					target: team.name,
				});
				return team;
			});
			return team;
		},

		updateTeam: async (
			_: unknown,
			args: { slug: string; id: string; input: unknown },
			ctx: GraphQLContext,
		) => {
			const { user, workspace } = await requireWorkspace(
				ctx,
				args.slug,
				"manageTeams",
			);
			const team = await requireTeam(workspace.id, args.id);
			const input = parse(teamInput, args.input);
			await checkName(workspace.id, input.name, team.id);
			return db.transaction(async (tx) => {
				const [updated] = await tx
					.update(tables.team)
					.set({
						name: input.name,
						description: input.description || null,
						icon: input.icon,
						color: input.color,
					})
					.where(eq(tables.team.id, team.id))
					.returning();
				await setMembers(tx, workspace.id, team.id, input.memberIds);
				await logActivity(tx, {
					workspace_id: workspace.id,
					actor_id: user.id,
					kind: "team",
					verb: "updated team",
					target: input.name,
				});
				return updated;
			});
		},

		deleteTeam: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const { user, workspace } = await requireWorkspace(
				ctx,
				args.slug,
				"manageTeams",
			);
			const team = await requireTeam(workspace.id, args.id);
			// People and projects stay; they just lose the team.
			await db.transaction(async (tx) => {
				const now = new Date();
				await tx
					.update(tables.team)
					.set({ deleted_at: now })
					.where(eq(tables.team.id, team.id));
				await tx
					.update(tables.team_members)
					.set({ deleted_at: now })
					.where(eq(tables.team_members.team_id, team.id));
				await tx
					.update(tables.project)
					.set({ team_id: null })
					.where(eq(tables.project.team_id, team.id));
				await logActivity(tx, {
					workspace_id: workspace.id,
					actor_id: user.id,
					kind: "team",
					verb: "deleted team",
					target: team.name,
				});
			});
			return true;
		},
	},
};
