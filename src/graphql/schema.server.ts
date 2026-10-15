import { and, asc, eq, ilike, isNull, or } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { db, tables } from "#/db";
import { CHANNEL_TYPE, STATUS, USER_ROLE } from "#/db/enums";
import {
	EMAIL_RE,
	MAX_INVITES,
	TEAM_SIZES,
	TEMPLATES,
	USE_CASES,
	VIEWS,
} from "#/lib/onboarding";

export type GraphQLContext = {
	user: { id: string; email: string; name: string } | null;
};

type Workspace = typeof tables.workspace.$inferSelect & { role?: string };
type Project = typeof tables.project.$inferSelect;

const typeDefs = /* GraphQL */ `
	type User {
		id: ID!
		name: String!
		email: String!
		image: String
	}

	type Workspace {
		id: ID!
		name: String!
		slug: String!
		imageUrl: String
		inviteCode: String!
		useCase: String
		teamSize: String
		defaultView: String!
		role: String!
		projects: [Project!]!
		teams: [Team!]!
	}

	type Team {
		id: ID!
		name: String!
		color: String
	}

	type Project {
		id: ID!
		title: String!
		description: String
		icon: String
		color: String
		tasks: [Task!]!
	}

	type Task {
		id: ID!
		name: String!
		status: String!
		priority: String!
	}

	input OnboardingInput {
		useCase: String!
		name: String!
		slug: String!
		defaultView: String!
		teamSize: String!
		projectName: String!
		templateId: String!
		invites: [String!]!
	}

	type SearchTask {
		id: ID!
		name: String!
		status: String!
		projectId: ID!
		projectTitle: String!
	}

	type Person {
		id: ID!
		name: String!
		email: String!
		image: String
	}

	type SearchResults {
		tasks: [SearchTask!]!
		projects: [Project!]!
		people: [Person!]!
	}

	type Query {
		me: User!
		workspaces: [Workspace!]!
		workspace(slug: String!): Workspace
		slugAvailable(slug: String!): Boolean!
		search(slug: String!, q: String!): SearchResults!
	}

	type Mutation {
		completeOnboarding(input: OnboardingInput!): Workspace!
		joinWorkspace(code: String!): Workspace!
	}
`;

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
const generateInviteCode = customAlphabet(
	"ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
	8,
);

const ids = <T extends readonly { id: string }[]>(items: T) =>
	items.map((item) => item.id) as [T[number]["id"], ...T[number]["id"][]];

const onboardingInput = z.object({
	useCase: z.enum(ids(USE_CASES)),
	name: z.string().trim().min(1, "Name your workspace to continue").max(255),
	slug: z.string().regex(SLUG_RE, "Use lowercase letters, numbers and dashes"),
	defaultView: z.enum(ids(VIEWS)),
	teamSize: z.enum(TEAM_SIZES),
	projectName: z.string().trim().min(1, "Give your project a name").max(255),
	templateId: z.enum(ids(TEMPLATES)),
	invites: z
		.array(z.string().trim().toLowerCase())
		.max(MAX_INVITES)
		.transform((list) => [...new Set(list.filter(Boolean))])
		.refine(
			(list) => list.every((email) => EMAIL_RE.test(email)),
			"One of the invite emails isn't valid",
		),
});

export function requireUser(ctx: GraphQLContext) {
	if (!ctx.user) {
		throw new GraphQLError("Sign in to continue", {
			extensions: { code: "UNAUTHENTICATED" },
		});
	}
	return ctx.user;
}

export function badInput(message: string): never {
	throw new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
}

const membership = (userId: string) =>
	and(
		eq(tables.workspace_members.user_id, userId),
		isNull(tables.workspace_members.deleted_at),
		isNull(tables.workspace.deleted_at),
	);

export async function findWorkspaces(
	userId: string,
	slug?: string,
): Promise<Workspace[]> {
	const rows = await db
		.select({
			workspace: tables.workspace,
			role: tables.workspace_members.role,
		})
		.from(tables.workspace_members)
		.innerJoin(
			tables.workspace,
			eq(tables.workspace.id, tables.workspace_members.workspace_id),
		)
		.where(
			slug
				? and(membership(userId), eq(tables.workspace.slug, slug))
				: membership(userId),
		)
		.orderBy(asc(tables.workspace.created_at));
	return rows.map((row) => ({ ...row.workspace, role: row.role }));
}

const resolvers = {
	Query: {
		search: async (
			_: unknown,
			args: { slug: string; q: string },
			ctx: GraphQLContext,
		) => {
			const [workspace] = await findWorkspaces(requireUser(ctx).id, args.slug);
			const q = args.q.trim().slice(0, 100);
			if (!workspace || !q) return { tasks: [], projects: [], people: [] };
			const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
			const LIMIT = 12;
			const [tasks, projects, people] = await Promise.all([
				db
					.select({
						id: tables.task.id,
						name: tables.task.name,
						status: tables.task.status,
						projectId: tables.project.id,
						projectTitle: tables.project.title,
					})
					.from(tables.task)
					.innerJoin(
						tables.project,
						eq(tables.project.id, tables.task.project_id),
					)
					.where(
						and(
							eq(tables.project.workspace_id, workspace.id),
							isNull(tables.task.deleted_at),
							isNull(tables.project.deleted_at),
							ilike(tables.task.name, like),
						),
					)
					.limit(LIMIT),
				db
					.select()
					.from(tables.project)
					.where(
						and(
							eq(tables.project.workspace_id, workspace.id),
							isNull(tables.project.deleted_at),
							ilike(tables.project.title, like),
						),
					)
					.limit(LIMIT),
				db
					.select({
						id: tables.workspace_members.id,
						name: tables.user.name,
						email: tables.user.email,
						image: tables.user.image,
					})
					.from(tables.workspace_members)
					.innerJoin(
						tables.user,
						eq(tables.user.id, tables.workspace_members.user_id),
					)
					.where(
						and(
							eq(tables.workspace_members.workspace_id, workspace.id),
							isNull(tables.workspace_members.deleted_at),
							or(ilike(tables.user.name, like), ilike(tables.user.email, like)),
						),
					)
					.limit(LIMIT),
			]);
			return { tasks, projects, people };
		},
		me: (_: unknown, __: unknown, ctx: GraphQLContext) => requireUser(ctx),
		workspaces: (_: unknown, __: unknown, ctx: GraphQLContext) =>
			findWorkspaces(requireUser(ctx).id),
		workspace: async (
			_: unknown,
			args: { slug: string },
			ctx: GraphQLContext,
		) => (await findWorkspaces(requireUser(ctx).id, args.slug))[0] ?? null,
		slugAvailable: async (
			_: unknown,
			args: { slug: string },
			ctx: GraphQLContext,
		) => {
			requireUser(ctx);
			if (!SLUG_RE.test(args.slug)) return false;
			const [taken] = await db
				.select({ id: tables.workspace.id })
				.from(tables.workspace)
				.where(eq(tables.workspace.slug, args.slug))
				.limit(1);
			return !taken;
		},
	},
	Mutation: {
		joinWorkspace: async (
			_: unknown,
			args: { code: string },
			ctx: GraphQLContext,
		) => {
			const user = requireUser(ctx);
			const [workspace] = await db
				.select()
				.from(tables.workspace)
				.where(
					and(
						eq(tables.workspace.invite_code, args.code.trim().toUpperCase()),
						isNull(tables.workspace.deleted_at),
					),
				)
				.limit(1);
			if (!workspace)
				badInput("This invite link isn't valid anymore. Ask for a new one.");

			const [existing] = await findWorkspaces(user.id, workspace.slug);
			if (existing) return existing;

			return db.transaction(async (tx) => {
				const [member] = await tx
					.insert(tables.workspace_members)
					.values({
						role: USER_ROLE.MEMBER,
						user_id: user.id,
						workspace_id: workspace.id,
					})
					.returning();
				if (!member) throw new Error("Member insert returned nothing");
				// Mark any emailed invite for this address as used
				await tx
					.update(tables.workspace_invite_request)
					.set({ status: "ACCEPTED" })
					.where(
						and(
							eq(tables.workspace_invite_request.workspace_id, workspace.id),
							eq(
								tables.workspace_invite_request.email,
								user.email.toLowerCase(),
							),
							eq(tables.workspace_invite_request.status, "PENDING"),
						),
					);
				const [general] = await tx
					.select({ id: tables.channel.id })
					.from(tables.channel)
					.where(
						and(
							eq(tables.channel.workspace_id, workspace.id),
							eq(tables.channel.name, "general"),
						),
					)
					.limit(1);
				if (general)
					await tx
						.insert(tables.channel_members)
						.values({ channel_id: general.id, member_id: member.id });
				return { ...workspace, role: member.role };
			});
		},
		completeOnboarding: async (
			_: unknown,
			args: { input: unknown },
			ctx: GraphQLContext,
		) => {
			const user = requireUser(ctx);
			const parsed = onboardingInput.safeParse(args.input);
			if (!parsed.success)
				badInput(
					parsed.error.issues[0]?.message ?? "Check your details and try again",
				);
			const input = parsed.data;
			const template = TEMPLATES.find((t) => t.id === input.templateId);
			if (!template) badInput("Pick a template");

			try {
				return await db.transaction(async (tx) => {
					const [workspace] = await tx
						.insert(tables.workspace)
						.values({
							name: input.name,
							slug: input.slug,
							invite_code: generateInviteCode(),
							use_case: input.useCase,
							team_size: input.teamSize,
							default_view: input.defaultView,
							user_id: user.id,
						})
						.returning();
					if (!workspace) throw new Error("Workspace insert returned nothing");

					const [member] = await tx
						.insert(tables.workspace_members)
						.values({
							role: USER_ROLE.OWNER,
							user_id: user.id,
							workspace_id: workspace.id,
						})
						.returning();
					if (!member) throw new Error("Member insert returned nothing");

					const [general] = await tx
						.insert(tables.channel)
						.values({
							workspace_id: workspace.id,
							name: "general",
							type: CHANNEL_TYPE.PUBLIC,
							created_by: user.id,
						})
						.returning();
					if (!general) throw new Error("Channel insert returned nothing");
					await tx
						.insert(tables.channel_members)
						.values({ channel_id: general.id, member_id: member.id });

					const [project] = await tx
						.insert(tables.project)
						.values({
							title: input.projectName,
							description: `Created during setup from the ${template.name} template.`,
							icon: template.icon,
							color: "indigo",
							status: STATUS.TODO,
							workspace_id: workspace.id,
						})
						.returning();
					if (!project) throw new Error("Project insert returned nothing");
					await tx
						.insert(tables.project_members)
						.values({ project_id: project.id, member_id: member.id });

					await tx.insert(tables.task).values(
						template.tasks.map((name) => ({
							name,
							status: STATUS.TODO,
							project_id: project.id,
						})),
					);

					const invites = input.invites.filter(
						(email) => email !== user.email.toLowerCase(),
					);
					if (invites.length) {
						const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
						await tx.insert(tables.workspace_invite_request).values(
							invites.map((email) => ({
								email,
								role: USER_ROLE.MEMBER,
								workspace_id: workspace.id,
								expires_at: expiresAt,
								invited_by: user.id,
							})),
						);
					}

					return { ...workspace, role: member.role };
				});
			} catch (error) {
				// Postgres unique violation on the slug: someone claimed the URL between the check and submit
				if ((error as { cause?: { code?: string } }).cause?.code === "23505") {
					badInput("That workspace URL is taken. Try another one.");
				}
				throw error;
			}
		},
	},
	Workspace: {
		imageUrl: (w: Workspace) => w.image_url,
		inviteCode: (w: Workspace) => w.invite_code,
		useCase: (w: Workspace) => w.use_case,
		teamSize: (w: Workspace) => w.team_size,
		defaultView: (w: Workspace) => w.default_view,
		// shortcut: one query per workspace/project; add a DataLoader when lists get long
		projects: (w: Workspace) =>
			db
				.select()
				.from(tables.project)
				.where(
					and(
						eq(tables.project.workspace_id, w.id),
						isNull(tables.project.deleted_at),
					),
				)
				.orderBy(asc(tables.project.created_at)),
		teams: (w: Workspace) =>
			db
				.select()
				.from(tables.team)
				.where(
					and(
						eq(tables.team.workspace_id, w.id),
						isNull(tables.team.deleted_at),
					),
				)
				.orderBy(asc(tables.team.name)),
	},
	Project: {
		tasks: (p: Project) =>
			db
				.select()
				.from(tables.task)
				.where(
					and(
						eq(tables.task.project_id, p.id),
						isNull(tables.task.parent_task_id),
						isNull(tables.task.deleted_at),
					),
				)
				.orderBy(asc(tables.task.created_at)),
	},
};

export { resolvers, typeDefs };
