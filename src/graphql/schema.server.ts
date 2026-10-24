import {
	and,
	asc,
	desc,
	eq,
	getTableColumns,
	gt,
	ilike,
	inArray,
	isNull,
	or,
	sql,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { GraphQLError } from "graphql";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { db, tables } from "#/db";
import { PROJECT_STATUS, STATUS, USER_ROLE } from "#/db/enums";
import { sendInviteEmails } from "#/lib/email.server";
import {
	EMAIL_RE,
	MAX_INVITES,
	TEAM_SIZES,
	TEMPLATES,
	USE_CASES,
	VIEWS,
} from "#/lib/onboarding";
import { can, projectRight } from "#/lib/permissions";
import { makeKey } from "#/lib/projects";
import { snippet } from "#/lib/search";
import { adminUserIds, logActivity, notify } from "./activity.server";
import { visibleBookmarks } from "./bookmarks.server";
import { visible as visibleNotes } from "./notes.server";

/** A sent invite that can still be accepted (pending, not revoked, not expired). */
const openInvite = () =>
	and(
		eq(tables.workspace_invite_request.status, "PENDING"),
		isNull(tables.workspace_invite_request.deleted_at),
		gt(tables.workspace_invite_request.expires_at, new Date()),
	);

export type GraphQLContext = {
	user: { id: string; email: string; name: string } | null;
};

type Workspace = typeof tables.workspace.$inferSelect & {
	role?: string;
	memberId?: string;
};

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
		status: String!
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

	type SearchNote {
		id: ID!
		title: String!
		icon: String
		"where the words matched, when it's in the body"
		snippet: String
	}

	type SearchBookmark {
		id: ID!
		title: String!
		url: String!
		site: String
	}

	type SearchComment {
		id: ID!
		snippet: String!
		taskId: ID!
		taskName: String!
		projectId: ID!
	}

	type SearchResults {
		tasks: [SearchTask!]!
		projects: [Project!]!
		people: [Person!]!
		notes: [SearchNote!]!
		bookmarks: [SearchBookmark!]!
		comments: [SearchComment!]!
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
export const generateInviteCode = customAlphabet(
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

export function forbidden(): never {
	throw new GraphQLError("You don't have permission to do that", {
		extensions: { code: "FORBIDDEN" },
	});
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
			memberId: tables.workspace_members.id,
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
	return rows.map((row) => ({
		...row.workspace,
		role: row.role,
		memberId: row.memberId,
	}));
}

/**
 * Which projects the viewer may see (src/lib/permissions.ts projectRight): admins see all;
 * others see projects shared with the workspace (not guests) and ones they lead or were
 * added to. Use inside `and(...)` on any column holding a project id.
 */
export function projectScope(
	w: { id: string; role?: string; memberId?: string; settings?: unknown },
	column: AnyPgColumn = tables.project.id,
) {
	if (can(w.role, "manageAllProjects", w.settings)) return undefined;
	const memberId = w.memberId ?? "";
	const mine = db
		.select({ id: tables.project_members.project_id })
		.from(tables.project_members)
		.where(
			and(
				eq(tables.project_members.member_id, memberId),
				isNull(tables.project_members.deleted_at),
			),
		);
	return inArray(
		column,
		db
			.select({ id: tables.project.id })
			.from(tables.project)
			.where(
				and(
					eq(tables.project.workspace_id, w.id),
					or(
						can(w.role, "viewAllProjects", w.settings)
							? eq(tables.project.access, "workspace")
							: undefined,
						eq(tables.project.lead_id, memberId),
						inArray(tables.project.id, mine),
					),
				),
			),
	);
}

const resolvers = {
	Query: {
		search: async (
			_: unknown,
			args: { slug: string; q: string },
			ctx: GraphQLContext,
		) => {
			const [workspace] = await findWorkspaces(requireUser(ctx).id, args.slug);
			if (!workspace)
				throw new GraphQLError("Workspace not found", {
					extensions: { code: "NOT_FOUND" },
				});
			const q = args.q.trim().slice(0, 100);
			if (!q)
				return {
					tasks: [],
					projects: [],
					people: [],
					notes: [],
					bookmarks: [],
					comments: [],
				};
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
							projectScope(workspace),
							or(
								ilike(tables.task.name, like),
								ilike(tables.task.description, like),
							),
						),
					)
					// name matches before description-only matches
					.orderBy(sql`${tables.task.name} ilike ${like} desc`)
					.limit(LIMIT),
				db
					.select()
					.from(tables.project)
					.where(
						and(
							eq(tables.project.workspace_id, workspace.id),
							isNull(tables.project.deleted_at),
							projectScope(workspace),
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
			const [notes, bookmarks, comments] = await Promise.all([
				db
					.select({
						id: tables.note.id,
						title: tables.note.title,
						icon: tables.note.icon,
						content: tables.note.content,
					})
					.from(tables.note)
					.where(
						and(
							visibleNotes(workspace),
							or(
								ilike(tables.note.title, like),
								ilike(tables.note.content, like),
							),
						),
					)
					.orderBy(sql`${tables.note.title} ilike ${like} desc`)
					.limit(LIMIT),
				// private bookmarks and collections are filtered after the query (visibleBookmarks)
				db
					.select({
						id: tables.bookmark.id,
						title: tables.bookmark.title,
						url: tables.bookmark.url,
						site: tables.bookmark.site,
						created_by: tables.bookmark.created_by,
						private: tables.bookmark.private,
					})
					.from(tables.bookmark)
					.where(
						and(
							eq(tables.bookmark.workspace_id, workspace.id),
							isNull(tables.bookmark.deleted_at),
							or(
								ilike(tables.bookmark.title, like),
								ilike(tables.bookmark.url, like),
								ilike(tables.bookmark.description, like),
							),
						),
					)
					.limit(LIMIT * 3)
					.then((rows) => visibleBookmarks(workspace, rows)),
				db
					.select({
						id: tables.comment.id,
						content: tables.comment.content,
						taskId: tables.task.id,
						taskName: tables.task.name,
						projectId: tables.project.id,
					})
					.from(tables.comment)
					.innerJoin(tables.task, eq(tables.task.id, tables.comment.entity_id))
					.innerJoin(
						tables.project,
						eq(tables.project.id, tables.task.project_id),
					)
					.where(
						and(
							eq(tables.comment.entity_type, "task"),
							isNull(tables.comment.deleted_at),
							eq(tables.project.workspace_id, workspace.id),
							isNull(tables.task.deleted_at),
							isNull(tables.project.deleted_at),
							projectScope(workspace),
							ilike(tables.comment.content, like),
						),
					)
					.orderBy(desc(tables.comment.created_at))
					.limit(LIMIT),
			]);
			return {
				tasks,
				projects,
				people,
				notes: notes.map(({ content, ...n }) => ({
					...n,
					snippet: snippet(content, q),
				})),
				bookmarks: bookmarks
					.slice(0, LIMIT)
					.map(({ created_by, private: _, ...b }) => b),
				comments: comments.map(({ content, ...c }) => ({
					...c,
					snippet: snippet(content, q) ?? content.slice(0, 120),
				})),
			};
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
			const code = args.code.trim();
			// The workspace link (only admins see it) or one emailed invite, by its id
			const [byCode] = await db
				.select()
				.from(tables.workspace)
				.where(
					and(
						eq(tables.workspace.invite_code, code.toUpperCase()),
						isNull(tables.workspace.deleted_at),
					),
				)
				.limit(1);
			const [byInvite] = byCode
				? []
				: await db
						.select({
							workspace: tables.workspace,
							email: tables.workspace_invite_request.email,
						})
						.from(tables.workspace_invite_request)
						.innerJoin(
							tables.workspace,
							eq(
								tables.workspace.id,
								tables.workspace_invite_request.workspace_id,
							),
						)
						.where(
							and(
								eq(tables.workspace_invite_request.id, code),
								openInvite(),
								isNull(tables.workspace.deleted_at),
							),
						)
						.limit(1);
			const workspace = byCode ?? byInvite?.workspace;
			if (!workspace)
				badInput("This invite link isn't valid anymore. Ask for a new one.");
			if (byInvite && byInvite.email !== user.email.toLowerCase())
				badInput(
					`This invite was sent to ${byInvite.email}. Sign in with that address to accept it.`,
				);

			const [existing] = await findWorkspaces(user.id, workspace.slug);
			if (existing) return existing;

			return db.transaction(async (tx) => {
				// An emailed invite decides their role and team; the bare link makes a member.
				const [invite] = await tx
					.select({
						role: tables.workspace_invite_request.role,
						teamId: tables.team.id,
						projectId: tables.workspace_invite_request.project_id,
						projectPermission:
							tables.workspace_invite_request.project_permission,
					})
					.from(tables.workspace_invite_request)
					.leftJoin(
						tables.team,
						and(
							eq(tables.team.id, tables.workspace_invite_request.team_id),
							isNull(tables.team.deleted_at),
						),
					)
					.where(
						and(
							eq(tables.workspace_invite_request.workspace_id, workspace.id),
							eq(
								tables.workspace_invite_request.email,
								user.email.toLowerCase(),
							),
							openInvite(),
						),
					)
					.orderBy(desc(tables.workspace_invite_request.created_at))
					.limit(1);
				const [member] = await tx
					.insert(tables.workspace_members)
					.values({
						role: invite?.role ?? USER_ROLE.MEMBER,
						user_id: user.id,
						workspace_id: workspace.id,
					})
					// A concurrent join already added them: the unique index rejects this row.
					.onConflictDoNothing()
					.returning();
				if (!member) return { ...workspace, role: USER_ROLE.MEMBER };
				if (invite?.teamId)
					await tx
						.insert(tables.team_members)
						.values({ team_id: invite.teamId, member_id: member.id });
				// invited from a project's Share modal: they land on that project
				if (invite?.projectId)
					await tx.insert(tables.project_members).values({
						project_id: invite.projectId,
						member_id: member.id,
						permission: invite.projectPermission,
					});
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
				await logActivity(tx, {
					workspace_id: workspace.id,
					actor_id: user.id,
					kind: "member",
					verb: "joined the workspace",
				});
				const admins = await adminUserIds(tx, workspace.id);
				await notify(
					tx,
					admins
						.filter((id) => id !== user.id)
						.map((id) => ({
							user_id: id,
							workspace_id: workspace.id,
							actor_id: user.id,
							type: "update",
							text: `joined ${workspace.name}`,
						})),
				);
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

			const invites = input.invites.filter(
				(email) => email !== user.email.toLowerCase(),
			);
			try {
				const { sent, ...workspace } = await db.transaction(async (tx) => {
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

					const [project] = await tx
						.insert(tables.project)
						.values({
							title: input.projectName,
							description: `Created during setup from the ${template.name} template.`,
							icon: template.icon,
							color: "indigo",
							status: PROJECT_STATUS.PLANNING,
							key: makeKey(input.projectName),
							start_date: new Date(),
							workspace_id: workspace.id,
							lead_id: member.id,
						})
						.returning();
					if (!project) throw new Error("Project insert returned nothing");
					await tx
						.insert(tables.project_members)
						.values({ project_id: project.id, member_id: member.id });

					await logActivity(tx, {
						workspace_id: workspace.id,
						actor_id: user.id,
						kind: "project",
						verb: "created project",
						target: project.title,
						project_id: project.id,
					});

					await tx.insert(tables.task).values(
						template.tasks.map((name, i) => ({
							name,
							status: STATUS.TODO,
							project_id: project.id,
							number: i + 1,
							sort_order: i + 1,
						})),
					);
					await tx
						.update(tables.project)
						.set({ task_seq: template.tasks.length })
						.where(eq(tables.project.id, project.id));

					const sent = invites.length
						? await tx
								.insert(tables.workspace_invite_request)
								.values(
									invites.map((email) => ({
										email,
										role: USER_ROLE.MEMBER,
										workspace_id: workspace.id,
										expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
										invited_by: user.id,
									})),
								)
								.returning({
									id: tables.workspace_invite_request.id,
									email: tables.workspace_invite_request.email,
									role: tables.workspace_invite_request.role,
								})
						: [];

					return { ...workspace, role: member.role, sent };
				});
				await sendInviteEmails(workspace, user.name, sent);
				return workspace;
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
		// the link makes whoever holds it a member, so only people who may invite members see it
		inviteCode: (w: Workspace & { role?: string }) =>
			can(w.role, "inviteMembers", w.settings) ? w.invite_code : "",
		useCase: (w: Workspace) => w.use_case,
		teamSize: (w: Workspace) => w.team_size,
		defaultView: (w: Workspace) => w.default_view,
		// shortcut: one query per workspace/project; add a DataLoader when lists get long
		// Favorite flag joined in one query instead of one lookup per project.
		projects: (w: Workspace, _: unknown, ctx: GraphQLContext) =>
			db
				.select({
					...getTableColumns(tables.project),
					isFavorite: sql<boolean>`${tables.favorite.id} is not null`,
					onProject: tables.project_members.id,
					permission: tables.project_members.permission,
				})
				.from(tables.project)
				.leftJoin(
					tables.favorite,
					and(
						eq(tables.favorite.entity_type, "project"),
						eq(tables.favorite.entity_id, tables.project.id),
						eq(tables.favorite.user_id, ctx.user?.id ?? ""),
					),
				)
				// the viewer's own membership, for their right on each project
				.leftJoin(
					tables.project_members,
					and(
						eq(tables.project_members.project_id, tables.project.id),
						eq(tables.project_members.member_id, w.memberId ?? ""),
						isNull(tables.project_members.deleted_at),
					),
				)
				.where(
					and(
						eq(tables.project.workspace_id, w.id),
						isNull(tables.project.deleted_at),
						isNull(tables.project.archived_at),
						projectScope(w),
					),
				)
				.orderBy(asc(tables.project.sort_order), asc(tables.project.created_at))
				.then((rows) =>
					rows.map(({ onProject, permission, ...p }) => ({
						...p,
						myAccess: projectRight(
							w.role,
							{ access: p.access, isLead: p.lead_id === w.memberId },
							onProject ? permission : undefined,
							w.settings,
						),
					})),
				),
		teams: (w: Workspace) =>
			db
				.select({
					...getTableColumns(tables.team),
					// counted here so a list of teams is one query, not two more per team
					memberCount:
						sql<number>`(select count(*) from ${tables.team_members} m where m.team_id = ${tables.team}.id and m.deleted_at is null)`.mapWith(
							Number,
						),
					projectCount:
						sql<number>`(select count(*) from ${tables.project} p where p.team_id = ${tables.team}.id and p.deleted_at is null)`.mapWith(
							Number,
						),
				})
				.from(tables.team)
				.where(
					and(
						eq(tables.team.workspace_id, w.id),
						isNull(tables.team.deleted_at),
					),
				)
				.orderBy(asc(tables.team.name)),
	},
};

export { resolvers, typeDefs };
