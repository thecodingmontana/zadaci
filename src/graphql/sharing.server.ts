import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, tables } from "#/db";
import { USER_ROLE } from "#/db/enums";
import { sendInviteEmails } from "#/lib/email.server";
import { EMAIL_RE } from "#/lib/onboarding";
import { can, PROJECT_RIGHTS, projectRight } from "#/lib/permissions";
import { logActivity, notify } from "./activity.server";
import { requireProject, viewerRight } from "./projects.server";
import {
	badInput,
	forbidden,
	type GraphQLContext,
	projectScope,
	requireUser,
} from "./schema.server";
import { checkInviteBudget } from "./settings.server";

// Project sharing (the reference app's Share modal): who is on a project, what each person
// may do there, and whether the whole workspace can see it. Managing it needs full access.

type Project = typeof tables.project.$inferSelect;

export const sharingTypeDefs = /* GraphQL */ `
	type ProjectMember {
		memberId: ID!
		name: String!
		email: String!
		image: String
		role: String!
		"their right on this project: view, comment, edit or full"
		permission: String!
		isLead: Boolean!
		isMe: Boolean!
	}

	extend type Project {
		members: [ProjectMember!]!
	}

	extend type Workspace {
		project(id: ID!): Project
		"whether a live project has this id, even one you can't open (deleted vs no access)"
		projectExists(id: ID!): Boolean!
	}

	extend type Mutation {
		shareProject(
			slug: String!
			projectId: ID!
			memberId: ID!
			permission: String!
		): Boolean!
		unshareProject(slug: String!, projectId: ID!, memberId: ID!): Boolean!
		inviteToProject(
			slug: String!
			projectId: ID!
			email: String!
			permission: String!
		): Boolean!
		setProjectAccess(slug: String!, projectId: ID!, access: String!): Project!
	}
`;

const RIGHT = z.enum(PROJECT_RIGHTS, { message: "Pick a permission" });
const ACCESS = z.enum(["workspace", "private"], {
	message: "Pick who can open the project",
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
	const result = schema.safeParse(value);
	if (!result.success)
		badInput(result.error.issues[0]?.message ?? "Invalid input");
	return result.data;
}

/** A live workspace member with their name, for sharing messages. */
async function findMember(
	workspaceId: string,
	where: { id?: string; email?: string },
) {
	const [member] = await db
		.select({
			id: tables.workspace_members.id,
			userId: tables.user.id,
			name: tables.user.name,
		})
		.from(tables.workspace_members)
		.innerJoin(
			tables.user,
			eq(tables.user.id, tables.workspace_members.user_id),
		)
		.where(
			and(
				eq(tables.workspace_members.workspace_id, workspaceId),
				isNull(tables.workspace_members.deleted_at),
				where.id ? eq(tables.workspace_members.id, where.id) : undefined,
				where.email ? eq(tables.user.email, where.email) : undefined,
			),
		);
	return member;
}

/** Adds someone to a project or changes their right there. */
async function share(
	workspaceId: string,
	actorId: string,
	project: Project,
	member: { id: string; userId: string; name: string },
	permission: string,
) {
	if (member.id === project.lead_id)
		badInput("The project lead always has full access");
	const where = and(
		eq(tables.project_members.project_id, project.id),
		eq(tables.project_members.member_id, member.id),
		isNull(tables.project_members.deleted_at),
	);
	const [existing] = await db
		.select({ id: tables.project_members.id })
		.from(tables.project_members)
		.where(where);
	if (existing) {
		await db.update(tables.project_members).set({ permission }).where(where);
		return;
	}
	await db
		.insert(tables.project_members)
		.values({ project_id: project.id, member_id: member.id, permission })
		// a concurrent share already added them
		.onConflictDoNothing();
	await logActivity(db, {
		workspace_id: workspaceId,
		actor_id: actorId,
		kind: "project",
		verb: "shared project",
		target: project.title,
		extra: `with ${member.name}`,
		project_id: project.id,
	});
	if (member.userId !== actorId)
		await notify(db, [
			{
				user_id: member.userId,
				workspace_id: workspaceId,
				actor_id: actorId,
				type: "update",
				text: "shared a project with you",
				snippet: project.title,
				project_id: project.id,
			},
		]);
}

export const sharingResolvers = {
	Project: {
		members: async (p: Project, _: unknown, ctx: GraphQLContext) => {
			const me = requireUser(ctx).id;
			const rows = await db
				.select({
					memberId: tables.workspace_members.id,
					role: tables.workspace_members.role,
					permission: tables.project_members.permission,
					userId: tables.user.id,
					name: tables.user.name,
					email: tables.user.email,
					image: tables.user.image,
				})
				.from(tables.project_members)
				.innerJoin(
					tables.workspace_members,
					eq(tables.workspace_members.id, tables.project_members.member_id),
				)
				.innerJoin(
					tables.user,
					eq(tables.user.id, tables.workspace_members.user_id),
				)
				.where(
					and(
						eq(tables.project_members.project_id, p.id),
						isNull(tables.project_members.deleted_at),
						isNull(tables.workspace_members.deleted_at),
					),
				)
				.orderBy(tables.project_members.created_at);
			return rows.map((r) => {
				const isLead = r.memberId === p.lead_id;
				return {
					...r,
					isLead,
					isMe: r.userId === me,
					permission:
						projectRight(r.role, { access: p.access, isLead }, r.permission) ??
						"view",
				};
			});
		},
	},
	Workspace: {
		project: async (
			w: { id: string; role?: string; memberId?: string },
			args: { id: string },
		) => {
			const [project] = await db
				.select()
				.from(tables.project)
				.where(
					and(
						eq(tables.project.id, args.id),
						eq(tables.project.workspace_id, w.id),
						isNull(tables.project.deleted_at),
						projectScope(w),
					),
				);
			if (!project) return null;
			return { ...project, myAccess: await viewerRight(w, project) };
		},
		projectExists: async (w: { id: string }, args: { id: string }) => {
			const [row] = await db
				.select({ id: tables.project.id })
				.from(tables.project)
				.where(
					and(
						eq(tables.project.id, args.id),
						eq(tables.project.workspace_id, w.id),
						isNull(tables.project.deleted_at),
					),
				);
			return !!row;
		},
	},
	Mutation: {
		shareProject: async (
			_: unknown,
			args: {
				slug: string;
				projectId: string;
				memberId: string;
				permission: string;
			},
			ctx: GraphQLContext,
		) => {
			const { user, workspace, project } = await requireProject(
				ctx,
				args.slug,
				args.projectId,
				{ right: "full" },
			);
			const permission = parse(RIGHT, args.permission);
			const member = await findMember(workspace.id, { id: args.memberId });
			if (!member) badInput("That person isn't in this workspace");
			await share(workspace.id, user.id, project, member, permission);
			return true;
		},

		unshareProject: async (
			_: unknown,
			args: { slug: string; projectId: string; memberId: string },
			ctx: GraphQLContext,
		) => {
			const { project } = await requireProject(ctx, args.slug, args.projectId, {
				right: "full",
			});
			if (args.memberId === project.lead_id)
				badInput("The project lead can't be removed");
			await db
				.update(tables.project_members)
				.set({ deleted_at: new Date() })
				.where(
					and(
						eq(tables.project_members.project_id, project.id),
						eq(tables.project_members.member_id, args.memberId),
						isNull(tables.project_members.deleted_at),
					),
				);
			return true;
		},

		inviteToProject: async (
			_: unknown,
			args: {
				slug: string;
				projectId: string;
				email: string;
				permission: string;
			},
			ctx: GraphQLContext,
		) => {
			const { user, workspace, project } = await requireProject(
				ctx,
				args.slug,
				args.projectId,
				{ right: "full" },
			);
			const permission = parse(RIGHT, args.permission);
			const email = args.email.trim().toLowerCase();
			if (!EMAIL_RE.test(email))
				badInput("Enter a valid email address, like name@company.com");
			// Someone already in the workspace is simply added to the project.
			const existing = await findMember(workspace.id, { email });
			if (existing) {
				await share(workspace.id, user.id, project, existing, permission);
				return true;
			}
			// A new person joins the workspace as a guest and lands on this project.
			if (!can(workspace.role, "inviteGuests", workspace.settings as object))
				forbidden();
			const pending = and(
				eq(tables.workspace_invite_request.workspace_id, workspace.id),
				eq(tables.workspace_invite_request.email, email),
				eq(tables.workspace_invite_request.status, "PENDING"),
				isNull(tables.workspace_invite_request.deleted_at),
				// someone who can only invite guests must not revive an expired member/admin invite
				can(workspace.role, "inviteMembers")
					? undefined
					: and(
							eq(tables.workspace_invite_request.role, USER_ROLE.GUEST),
							gt(tables.workspace_invite_request.expires_at, new Date()),
						),
			);
			const target = {
				project_id: project.id,
				project_permission: permission,
				expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			};
			const [updated] = await db
				.update(tables.workspace_invite_request)
				.set(target)
				.where(pending)
				.returning({
					id: tables.workspace_invite_request.id,
					role: tables.workspace_invite_request.role,
				});
			if (!updated) await checkInviteBudget(workspace.id, 1);
			const [inserted] = updated
				? [updated]
				: await db
						.insert(tables.workspace_invite_request)
						.values({
							...target,
							email,
							role: USER_ROLE.GUEST,
							workspace_id: workspace.id,
							invited_by: user.id,
							team_id: project.team_id,
						})
						.returning({
							id: tables.workspace_invite_request.id,
							role: tables.workspace_invite_request.role,
						});
			if (!inserted) throw new Error("Invite insert returned nothing");
			await sendInviteEmails(workspace, user.name, [{ email, ...inserted }]);
			return true;
		},

		setProjectAccess: async (
			_: unknown,
			args: { slug: string; projectId: string; access: string },
			ctx: GraphQLContext,
		) => {
			const { user, workspace, project } = await requireProject(
				ctx,
				args.slug,
				args.projectId,
				{ right: "full" },
			);
			const access = parse(ACCESS, args.access);
			const [updated] = await db
				.update(tables.project)
				.set({ access })
				.where(eq(tables.project.id, project.id))
				.returning();
			if (access !== project.access)
				await logActivity(db, {
					workspace_id: workspace.id,
					actor_id: user.id,
					kind: "project",
					verb: access === "private" ? "made project" : "opened project",
					target: project.title,
					extra: access === "private" ? "private" : "to the workspace",
					project_id: project.id,
				});
			return { ...updated, myAccess: "full" };
		},
	},
};
