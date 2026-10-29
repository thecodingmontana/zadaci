import { createHash } from "node:crypto";
import { and, count, eq, isNull, lt, ne, sql } from "drizzle-orm";
import { GraphQLError, GraphQLScalarType } from "graphql";
import { z } from "zod";
import { db, tables } from "#/db";
import { USER_ROLE } from "#/db/enums";
import { deleteAccount, deletionPreview } from "#/lib/account.server";
import { isDicebearUrl } from "#/lib/dicebear";
import { sendInviteEmails } from "#/lib/email.server";
import { requireEnv } from "#/lib/env";
import { EMAIL_RE } from "#/lib/onboarding";
import { can, LOCKED, PERMISSIONS, type Permission } from "#/lib/permissions";
import {
	PREF_DEFAULTS,
	preferencesPatch,
	ROLE_LABEL,
	WS_COLORS,
	WS_SETTINGS_DEFAULTS,
	workspaceSettingsPatch,
} from "#/lib/preferences";
import { realtimeConfig } from "#/lib/realtime.server";
import { logActivity, notify } from "./activity.server";
import {
	badInput,
	findWorkspaces,
	forbidden,
	type GraphQLContext,
	generateInviteCode,
	requireUser,
	SLUG_RE,
} from "./schema.server";

type Workspace = typeof tables.workspace.$inferSelect & { role?: string };

export const settingsTypeDefs = /* GraphQL */ `
	scalar JSON

	type Member {
		id: ID!
		userId: ID!
		role: String!
		name: String!
		email: String!
		image: String
		isMe: Boolean!
		title: String
		tz: String
	}

	type Invite {
		id: ID!
		email: String!
		role: String!
		teamId: ID
	}

	type CloudinaryUpload {
		url: String!
		apiKey: String!
		timestamp: Int!
		signature: String!
		publicId: String!
		folder: String!
	}

	input WorkspaceInput {
		name: String
		slug: String
		color: String
		defaultView: String
		settings: JSON
	}

	extend type Workspace {
		color: String
		settings: JSON!
		members: [Member!]!
		invites: [Invite!]!
		projectCount: Int!
	}

	extend type Team {
		icon: String
		description: String
		memberCount: Int!
		projectCount: Int!
	}

	extend type User {
		preferences: JSON!
	}

	"what deleting your account would do"
	type AccountDeletion {
		"workspaces you own with other people: hand them over first"
		blockers: [String!]!
		"workspaces where you're the only member: deleted with your account"
		solo: [String!]!
	}

	"where the browser listens for live updates (Supabase Realtime); null when it isn't set up"
	type RealtimeConfig {
		url: String!
		anonKey: String!
		"browsers join with a signed-in token, and Supabase checks they belong"
		private: Boolean!
	}

	extend type Query {
		accountDeletion: AccountDeletion!
		realtime: RealtimeConfig
	}

	extend type Mutation {
		"erases your account; type your email to confirm"
		deleteMyAccount(email: String!): Boolean!
		updatePreferences(patch: JSON!): JSON!
		updateWorkspace(slug: String!, input: WorkspaceInput!): Workspace!
		deleteWorkspace(slug: String!): Boolean!
		setWorkspaceImage(slug: String!, imageUrl: String): Workspace!
		inviteMembers(
			slug: String!
			emails: [String!]!
			role: String!
			teamId: ID
		): [Invite!]!
		revokeInvite(slug: String!, id: ID!): Boolean!
		resendInvite(slug: String!, id: ID!): Boolean!
		updateMemberRole(slug: String!, memberId: ID!, role: String!): Member!
		removeMember(slug: String!, memberId: ID!): Boolean!
	}
`;

const JSONScalar = new GraphQLScalarType({
	name: "JSON",
	serialize: (v) => v,
	parseValue: (v) => v,
});

const INVITE_ROLES = z.enum([
	USER_ROLE.MODERATOR,
	USER_ROLE.MEMBER,
	USER_ROLE.GUEST,
]);

/** The signed-in user's workspace, failing unless their role is in `roles`. */
export async function requireWorkspace(
	ctx: GraphQLContext,
	slug: string,
	permission?: Permission,
) {
	const user = requireUser(ctx);
	const [workspace] = await findWorkspaces(user.id, slug);
	if (!workspace)
		throw new GraphQLError("Workspace not found", {
			extensions: { code: "NOT_FOUND" },
		});
	if (permission && !can(workspace.role, permission, workspace.settings))
		forbidden();
	return { user, workspace };
}

/**
 * Invite emails one person may send in a day, across all their workspaces, new and resent:
 * they go to outside addresses from our domain, so a fresh workspace mustn't reset the count.
 */
export const DAILY_INVITES = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Takes `adding` invite emails from the person's daily budget, or refuses them all. */
export async function checkInviteBudget(userId: string, adding: number) {
	if (adding <= 0) return;
	const refuse = () =>
		badInput(
			`You can send up to ${DAILY_INVITES} invite emails a day. Try again tomorrow.`,
		);
	if (adding > DAILY_INVITES) refuse();
	const key = `invite-emails:${userId}`;
	const now = Date.now();
	const fresh = sql`${tables.rateLimit.lastRequest} < ${now - DAY_MS}`;
	// one atomic statement, so requests at the same moment can't both slip under the cap
	const [taken] = await db
		.insert(tables.rateLimit)
		.values({ id: key, key, count: adding, lastRequest: now })
		.onConflictDoUpdate({
			target: tables.rateLimit.key,
			set: {
				count: sql`case when ${fresh} then ${adding} else ${tables.rateLimit.count} + ${adding} end`,
				lastRequest: sql`case when ${fresh} then ${now} else ${tables.rateLimit.lastRequest} end`,
			},
			setWhere: sql`${fresh} or ${tables.rateLimit.count} + ${adding} <= ${DAILY_INVITES}`,
		})
		.returning({ count: tables.rateLimit.count });
	if (!taken) refuse();
}

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
	const result = schema.safeParse(value);
	if (!result.success)
		badInput(result.error.issues[0]?.message ?? "Invalid input");
	return result.data;
}

export function cloudinary() {
	return {
		cloud: requireEnv("CLOUDINARY_CLOUD_NAME"),
		key: requireEnv("CLOUDINARY_API_KEY"),
		secret: requireEnv("CLOUDINARY_API_SECRET"),
	};
}

/** Cloudinary signature: sha1 of the sorted params joined as k=v&… followed by the API secret. */
export function signCloudinary(
	params: Record<string, string | number>,
	secret: string,
) {
	const payload = Object.keys(params)
		.sort()
		.map((k) => `${k}=${params[k]}`)
		.join("&");
	return createHash("sha1")
		.update(payload + secret)
		.digest("hex");
}

const memberRows = (workspaceId: string) =>
	db
		.select({
			id: tables.workspace_members.id,
			role: tables.workspace_members.role,
			userId: tables.user.id,
			name: tables.user.name,
			email: tables.user.email,
			image: tables.user.image,
			preferences: tables.user.preferences,
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
			),
		)
		.orderBy(tables.workspace_members.created_at);

/** Custom permissions as saved: only real ones the owner hasn't locked, each role once. */
function customPermissions(overrides: Record<string, string[]>) {
	return Object.fromEntries(
		Object.entries(overrides)
			.filter(
				([key]) => key in PERMISSIONS && !LOCKED.includes(key as Permission),
			)
			.map(([key, roles]) => [key, [...new Set(roles)]]),
	);
}

export const settingsResolvers = {
	JSON: JSONScalar,
	User: {
		preferences: async (u: { id: string }) => {
			const [row] = await db
				.select({ preferences: tables.user.preferences })
				.from(tables.user)
				.where(eq(tables.user.id, u.id));
			const saved = (row?.preferences ?? {}) as Record<string, unknown>;
			return {
				...PREF_DEFAULTS,
				...saved,
				notif: { ...PREF_DEFAULTS.notif, ...(saved.notif as object) },
			};
		},
	},
	Workspace: {
		color: (w: Workspace) => w.color,
		settings: (w: Workspace) => ({
			...WS_SETTINGS_DEFAULTS,
			...w.settings,
		}),
		members: async (w: Workspace, _: unknown, ctx: GraphQLContext) => {
			const me = requireUser(ctx).id;
			return (await memberRows(w.id)).map(({ preferences, ...m }) => {
				const p = (preferences ?? {}) as { title?: string; tz?: string };
				return {
					...m,
					isMe: m.userId === me,
					title: p.title || null,
					tz: p.tz || null,
				};
			});
		},
		invites: (w: Workspace) =>
			can(w.role, "inviteMembers", w.settings)
				? db
						.select({
							id: tables.workspace_invite_request.id,
							email: tables.workspace_invite_request.email,
							role: tables.workspace_invite_request.role,
							teamId: tables.workspace_invite_request.team_id,
						})
						.from(tables.workspace_invite_request)
						.where(
							and(
								eq(tables.workspace_invite_request.workspace_id, w.id),
								eq(tables.workspace_invite_request.status, "PENDING"),
								isNull(tables.workspace_invite_request.deleted_at),
							),
						)
				: [],
		projectCount: async (w: Workspace) => {
			const [row] = await db
				.select({ n: count() })
				.from(tables.project)
				.where(
					and(
						eq(tables.project.workspace_id, w.id),
						isNull(tables.project.deleted_at),
					),
				);
			return row?.n ?? 0;
		},
	},
	Team: {
		memberCount: async (t: { id: string; memberCount?: number }) => {
			if (t.memberCount !== undefined) return t.memberCount;
			const [row] = await db
				.select({ n: count() })
				.from(tables.team_members)
				.where(
					and(
						eq(tables.team_members.team_id, t.id),
						isNull(tables.team_members.deleted_at),
					),
				);
			return row?.n ?? 0;
		},
		projectCount: async (t: { id: string; projectCount?: number }) => {
			if (t.projectCount !== undefined) return t.projectCount;
			const [row] = await db
				.select({ n: count() })
				.from(tables.project)
				.where(
					and(
						eq(tables.project.team_id, t.id),
						isNull(tables.project.deleted_at),
					),
				);
			return row?.n ?? 0;
		},
	},
	Query: {
		realtime: (_: unknown, __: unknown, ctx: GraphQLContext) => {
			requireUser(ctx);
			return realtimeConfig();
		},
		accountDeletion: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
			const { blockers, solo } = await deletionPreview(requireUser(ctx).id);
			return {
				blockers: blockers.map((b) => b.name),
				solo: solo.map((w) => w.name),
			};
		},
	},
	Mutation: {
		deleteMyAccount: async (
			_: unknown,
			args: { email: string },
			ctx: GraphQLContext,
		) => {
			const user = requireUser(ctx);
			if (args.email.trim().toLowerCase() !== user.email.toLowerCase())
				badInput("Type your email exactly to confirm");
			try {
				await deleteAccount(user.id);
			} catch (error) {
				badInput((error as Error).message);
			}
			return true;
		},
		updatePreferences: async (
			_: unknown,
			args: { patch: unknown },
			ctx: GraphQLContext,
		) => {
			const user = requireUser(ctx);
			const patch = parse(preferencesPatch, args.patch);
			for (const zone of [patch.tz, patch.autoTz])
				if (zone && !Intl.supportedValuesOf("timeZone").includes(zone))
					badInput("Unknown time zone");
			const [row] = await db
				.select({ preferences: tables.user.preferences })
				.from(tables.user)
				.where(eq(tables.user.id, user.id));
			const saved = (row?.preferences ?? {}) as Record<string, unknown>;
			const next = {
				...saved,
				...patch,
				notif: { ...(saved.notif as object), ...patch.notif },
			};
			await db
				.update(tables.user)
				.set({ preferences: next })
				.where(eq(tables.user.id, user.id));
			return {
				...PREF_DEFAULTS,
				...next,
				notif: { ...PREF_DEFAULTS.notif, ...next.notif },
			};
		},

		updateWorkspace: async (
			_: unknown,
			args: { slug: string; input: Record<string, unknown> },
			ctx: GraphQLContext,
		) => {
			const { workspace } = await requireWorkspace(
				ctx,
				args.slug,
				"workspaceSettings",
			);
			const input = parse(
				z
					.object({
						name: z
							.string()
							.trim()
							.min(1, "Workspace name can't be empty")
							.max(255),
						slug: z
							.string()
							.regex(SLUG_RE, "Use lowercase letters, numbers and dashes"),
						color: z.enum(WS_COLORS),
						defaultView: z.enum([
							"board",
							"list",
							"table",
							"overview",
							"timeline",
						]),
						settings: workspaceSettingsPatch,
					})
					.partial()
					.strict(),
				args.input,
			);
			try {
				const [updated] = await db
					.update(tables.workspace)
					.set({
						name: input.name,
						slug: input.slug,
						color: input.color,
						default_view: input.defaultView,
						settings: input.settings
							? {
									...(workspace.settings as object),
									...input.settings,
									...(input.settings.permOverrides && {
										permOverrides: customPermissions(
											input.settings.permOverrides,
										),
									}),
								}
							: undefined,
					})
					.where(eq(tables.workspace.id, workspace.id))
					.returning();
				return { ...updated, role: workspace.role };
			} catch (error) {
				if ((error as { cause?: { code?: string } }).cause?.code === "23505") {
					badInput("That workspace URL is taken. Try another one.");
				}
				throw error;
			}
		},

		deleteWorkspace: async (
			_: unknown,
			args: { slug: string },
			ctx: GraphQLContext,
		) => {
			const { workspace } = await requireWorkspace(
				ctx,
				args.slug,
				"deleteWorkspace",
			);
			// Soft delete; frees the URL so it can be reused.
			await db
				.update(tables.workspace)
				.set({
					deleted_at: new Date(),
					slug: `deleted-${workspace.id.toLowerCase()}`,
				})
				.where(eq(tables.workspace.id, workspace.id));
			return true;
		},

		setWorkspaceImage: async (
			_: unknown,
			args: { slug: string; imageUrl: string | null },
			ctx: GraphQLContext,
		) => {
			const { workspace } = await requireWorkspace(
				ctx,
				args.slug,
				"workspaceSettings",
			);
			// Only accept images we uploaded for this workspace, a generated DiceBear avatar, or an
			// Unsplash photo picked in "Choose avatar".
			const allowed = `https://res.cloudinary.com/${cloudinary().cloud}/image/upload/`;
			if (
				args.imageUrl !== null &&
				!isDicebearUrl(args.imageUrl) &&
				!args.imageUrl.startsWith("https://images.unsplash.com/") &&
				!(
					args.imageUrl.startsWith(allowed) &&
					args.imageUrl.includes(`/zadaci/workspaces/${workspace.id}.`)
				)
			) {
				badInput("That image wasn't uploaded for this workspace");
			}
			const [updated] = await db
				.update(tables.workspace)
				.set({ image_url: args.imageUrl })
				.where(eq(tables.workspace.id, workspace.id))
				.returning();
			return { ...updated, role: workspace.role };
		},

		inviteMembers: async (
			_: unknown,
			args: {
				slug: string;
				emails: string[];
				role: string;
				teamId?: string | null;
			},
			ctx: GraphQLContext,
		) => {
			const { user, workspace } = await requireWorkspace(ctx, args.slug);
			const role = parse(INVITE_ROLES, args.role);
			// Guests can be invited by members when "Members can invite guests" is on.
			const needed =
				role === USER_ROLE.GUEST ? "inviteGuests" : "inviteMembers";
			if (!can(workspace.role, needed, workspace.settings)) forbidden();
			if (args.teamId) {
				const [team] = await db
					.select({ id: tables.team.id })
					.from(tables.team)
					.where(
						and(
							eq(tables.team.id, args.teamId),
							eq(tables.team.workspace_id, workspace.id),
							isNull(tables.team.deleted_at),
						),
					);
				if (!team) badInput("That team doesn't exist anymore");
			}
			const emails = [
				...new Set(
					args.emails.map((e) => e.trim().toLowerCase()).filter(Boolean),
				),
			];
			if (!emails.length) badInput("Add at least one email address");
			if (emails.length > 50) badInput("Invite up to 50 people at a time");
			const bad = emails.find((e) => !EMAIL_RE.test(e));
			if (bad) badInput(`${bad} isn't a valid email address`);
			const taken = new Set(
				(await memberRows(workspace.id)).map((m) => m.email.toLowerCase()),
			);
			// Skip people already in the workspace or already waiting on an invite.
			const pending = await db
				.select({ email: tables.workspace_invite_request.email })
				.from(tables.workspace_invite_request)
				.where(
					and(
						eq(tables.workspace_invite_request.workspace_id, workspace.id),
						eq(tables.workspace_invite_request.status, "PENDING"),
						isNull(tables.workspace_invite_request.deleted_at),
					),
				);
			for (const p of pending) taken.add(p.email.toLowerCase());
			const fresh = emails.filter((e) => !taken.has(e));
			if (!fresh.length) return [];
			await checkInviteBudget(user.id, fresh.length);
			await logActivity(db, {
				workspace_id: workspace.id,
				actor_id: user.id,
				kind: "member",
				verb: "invited",
				target: fresh.length === 1 ? fresh[0] : `${fresh.length} people`,
				extra: `as ${ROLE_LABEL[role]?.toLowerCase()}`,
			});
			const created = await db
				.insert(tables.workspace_invite_request)
				.values(
					fresh.map((email) => ({
						email,
						role,
						workspace_id: workspace.id,
						invited_by: user.id,
						team_id: args.teamId || null,
						expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
					})),
				)
				.returning({
					id: tables.workspace_invite_request.id,
					email: tables.workspace_invite_request.email,
					role: tables.workspace_invite_request.role,
					teamId: tables.workspace_invite_request.team_id,
				});
			await sendInviteEmails(workspace, user.name, created);
			return created;
		},

		resendInvite: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const { user, workspace } = await requireWorkspace(
				ctx,
				args.slug,
				"inviteMembers",
			);
			const [invite] = await db
				.update(tables.workspace_invite_request)
				.set({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) })
				.where(
					and(
						eq(tables.workspace_invite_request.id, args.id),
						eq(tables.workspace_invite_request.workspace_id, workspace.id),
						eq(tables.workspace_invite_request.status, "PENDING"),
						isNull(tables.workspace_invite_request.deleted_at),
						// one email a minute per invite, so resend can't be used to spam
						lt(
							tables.workspace_invite_request.updated_at,
							new Date(Date.now() - 60 * 1000),
						),
					),
				)
				.returning({
					id: tables.workspace_invite_request.id,
					email: tables.workspace_invite_request.email,
					role: tables.workspace_invite_request.role,
				});
			if (!invite)
				badInput(
					"Invite not found, or it was just sent. Try again in a minute.",
				);
			await checkInviteBudget(user.id, 1);
			const [sent] = await sendInviteEmails(workspace, user.name, [invite]);
			if (!sent) badInput("Couldn't send the email. Try again in a moment.");
			return true;
		},

		revokeInvite: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const { workspace } = await requireWorkspace(
				ctx,
				args.slug,
				"inviteMembers",
			);
			await db
				.update(tables.workspace_invite_request)
				.set({ status: "REVOKED" })
				.where(
					and(
						eq(tables.workspace_invite_request.id, args.id),
						eq(tables.workspace_invite_request.workspace_id, workspace.id),
					),
				);
			return true;
		},

		updateMemberRole: async (
			_: unknown,
			args: { slug: string; memberId: string; role: string },
			ctx: GraphQLContext,
		) => {
			const { user, workspace } = await requireWorkspace(
				ctx,
				args.slug,
				"manageRoles",
			);
			const role = parse(INVITE_ROLES, args.role);
			const target = (await memberRows(workspace.id)).find(
				(m) => m.id === args.memberId,
			);
			if (!target) badInput("Member not found");
			if (target.role === USER_ROLE.OWNER)
				badInput("The workspace owner's role can't be changed");
			await db
				.update(tables.workspace_members)
				.set({ role })
				.where(
					and(
						eq(tables.workspace_members.id, target.id),
						ne(tables.workspace_members.role, USER_ROLE.OWNER),
					),
				);
			if (target.role !== role) {
				const label = ROLE_LABEL[role]?.toLowerCase();
				await logActivity(db, {
					workspace_id: workspace.id,
					actor_id: user.id,
					kind: "member",
					verb: "changed the role of",
					target: target.name,
					extra: `to ${label}`,
				});
				if (target.userId !== user.id)
					await notify(db, [
						{
							user_id: target.userId,
							workspace_id: workspace.id,
							actor_id: user.id,
							type: "update",
							text: `changed your role in ${workspace.name} to ${label}`,
						},
					]);
			}
			return { ...target, role, isMe: target.userId === user.id };
		},

		removeMember: async (
			_: unknown,
			args: { slug: string; memberId: string },
			ctx: GraphQLContext,
		) => {
			const { user, workspace } = await requireWorkspace(
				ctx,
				args.slug,
				"manageRoles",
			);
			const target = (await memberRows(workspace.id)).find(
				(m) => m.id === args.memberId,
			);
			if (!target) badInput("Member not found");
			if (target.role === USER_ROLE.OWNER)
				badInput("The workspace owner can't be removed");
			// New invite code in the same transaction, so the removed member's old link stops working.
			await db.transaction(async (tx) => {
				// They lose their projects, teams and task assignments too (reference removeMember).
				const now = new Date();
				await tx
					.update(tables.workspace_members)
					.set({ deleted_at: now })
					.where(eq(tables.workspace_members.id, target.id));
				for (const t of [
					tables.project_members,
					tables.team_members,
					tables.task_assignees,
				])
					await tx
						.update(t)
						.set({ deleted_at: now })
						.where(and(eq(t.member_id, target.id), isNull(t.deleted_at)));
				await tx
					.update(tables.workspace)
					.set({ invite_code: generateInviteCode() })
					.where(eq(tables.workspace.id, workspace.id));
				await logActivity(tx, {
					workspace_id: workspace.id,
					actor_id: user.id,
					kind: "member",
					verb: "removed",
					target: target.name,
					extra: "from the workspace",
				});
			});
			return true;
		},
	},
};
