import {
	and,
	count,
	desc,
	eq,
	ilike,
	inArray,
	isNull,
	ne,
	or,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, tables } from "#/db";
import { ADMIN_ROLES, can } from "#/lib/permissions";
import {
	badInput,
	findWorkspaces,
	type GraphQLContext,
	projectScope,
	requireUser,
} from "./schema.server";

// Workspace activity feed and per-person notifications (ported from the reference app's
// Activity, Notifications and Inbox pages). Mutations elsewhere write rows through
// logActivity() and notify().

type Q = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export function logActivity(q: Q, row: typeof tables.activity.$inferInsert) {
	return q.insert(tables.activity).values(row);
}

export async function notify(
	q: Q,
	rows: (typeof tables.notification.$inferInsert)[],
) {
	if (rows.length) await q.insert(tables.notification).values(rows);
}

/** User ids of the workspace's owner and admins, for "someone joined" style updates. */
export async function adminUserIds(q: Q, workspaceId: string) {
	const rows = await q
		.select({ id: tables.workspace_members.user_id })
		.from(tables.workspace_members)
		.where(
			and(
				eq(tables.workspace_members.workspace_id, workspaceId),
				isNull(tables.workspace_members.deleted_at),
				inArray(tables.workspace_members.role, [...ADMIN_ROLES] as never[]),
			),
		);
	return rows.map((r) => r.id);
}

/** User ids of a project's members, for updates about that project. */
export async function projectUserIds(q: Q, projectId: string) {
	const rows = await q
		.select({ id: tables.workspace_members.user_id })
		.from(tables.project_members)
		.innerJoin(
			tables.workspace_members,
			eq(tables.workspace_members.id, tables.project_members.member_id),
		)
		.where(
			and(
				eq(tables.project_members.project_id, projectId),
				isNull(tables.project_members.deleted_at),
				isNull(tables.workspace_members.deleted_at),
			),
		);
	return rows.map((r) => r.id);
}

export const activityTypeDefs = /* GraphQL */ `
	type Activity {
		id: ID!
		kind: String!
		verb: String!
		target: String
		extra: String
		projectId: ID
		taskId: ID
		actor: Person
		createdAt: String!
	}

	type Notification {
		id: ID!
		type: String!
		text: String!
		snippet: String
		projectId: ID
		projectTitle: String
		projectColor: String
		taskId: ID
		taskTitle: String
		actor: Person
		read: Boolean!
		createdAt: String!
	}

	extend type Workspace {
		activity(filter: String, actorId: ID): [Activity!]!
		notifications(unread: Boolean): [Notification!]!
		unreadNotifications: Int!
		unreadInbox: Int!
	}

	extend type Mutation {
		setNotificationRead(slug: String!, id: ID!, read: Boolean!): Notification!
		markAllNotificationsRead(slug: String!): Int!
	}
`;

const ACTIVITY_FILTERS = {
	all: undefined,
	status: and(
		eq(tables.activity.kind, "task"),
		inArray(tables.activity.verb, ["moved", "completed", "reopened"]),
	),
	comments: ilike(tables.activity.verb, "%comment%"),
	projects: eq(tables.activity.kind, "project"),
};

const actor = alias(tables.user, "actor");
const person = {
	id: actor.id,
	name: actor.name,
	email: actor.email,
	image: actor.image,
};

const notificationRows = (where: ReturnType<typeof and>) =>
	db
		.select({
			n: tables.notification,
			actor: person,
			project: {
				id: tables.project.id,
				title: tables.project.title,
				color: tables.project.color,
			},
			taskTitle: tables.task.name,
		})
		.from(tables.notification)
		.leftJoin(actor, eq(actor.id, tables.notification.actor_id))
		.leftJoin(
			tables.task,
			and(
				eq(tables.task.id, tables.notification.task_id),
				isNull(tables.task.deleted_at),
			),
		)
		.leftJoin(
			tables.project,
			and(
				or(
					eq(tables.project.id, tables.notification.project_id),
					eq(tables.project.id, tables.task.project_id),
				),
				isNull(tables.project.deleted_at),
			),
		)
		.where(where)
		.orderBy(desc(tables.notification.created_at))
		// shortcut: newest 100 only, add a "load more" cursor once inboxes get long
		.limit(100)
		.then((rows) =>
			rows.map((r) => ({
				id: r.n.id,
				type: r.n.type,
				text: r.n.text,
				snippet: r.n.snippet,
				projectId: r.project?.id ?? null,
				projectTitle: r.project?.title ?? null,
				projectColor: r.project?.color ?? null,
				taskId: r.taskTitle ? r.n.task_id : null,
				taskTitle: r.taskTitle,
				actor: r.actor,
				read: !!r.n.read_at,
				createdAt: r.n.created_at.toISOString(),
			})),
		);

const unreadCount = async (where: ReturnType<typeof and>) => {
	const [row] = await db
		.select({ n: count() })
		.from(tables.notification)
		.where(where);
	return row?.n ?? 0;
};

const mine = (ctx: GraphQLContext, workspaceId: string) =>
	and(
		eq(tables.notification.user_id, requireUser(ctx).id),
		eq(tables.notification.workspace_id, workspaceId),
	);

async function requireSlug(ctx: GraphQLContext, slug: string) {
	const [workspace] = await findWorkspaces(requireUser(ctx).id, slug);
	if (!workspace) badInput("Workspace not found");
	return workspace;
}

export const activityResolvers = {
	Workspace: {
		activity: async (
			w: { id: string; role?: string; memberId?: string },
			args: { filter?: string | null; actorId?: string | null },
		) => {
			const filter =
				ACTIVITY_FILTERS[
					(args.filter ?? "all") as keyof typeof ACTIVITY_FILTERS
				];
			const rows = await db
				.select({
					a: tables.activity,
					actor: person,
					liveProject: tables.project.id,
				})
				.from(tables.activity)
				.leftJoin(actor, eq(actor.id, tables.activity.actor_id))
				.leftJoin(
					tables.project,
					and(
						eq(tables.project.id, tables.activity.project_id),
						isNull(tables.project.deleted_at),
					),
				)
				.where(
					and(
						eq(tables.activity.workspace_id, w.id),
						filter,
						// workspace-wide events, plus events from projects the viewer can see
						can(w.role, "manageAllProjects")
							? undefined
							: or(
									isNull(tables.activity.project_id),
									projectScope(w, tables.activity.project_id),
								),
						args.actorId
							? eq(tables.activity.actor_id, args.actorId)
							: undefined,
					),
				)
				.orderBy(desc(tables.activity.created_at))
				// shortcut: newest 100 only, add a "load more" cursor once feeds get long
				.limit(100);
			return rows.map((r) => ({
				id: r.a.id,
				kind: r.a.kind,
				verb: r.a.verb,
				target: r.a.target,
				extra: r.a.extra,
				// only link to projects that still exist
				projectId: r.liveProject,
				taskId: r.a.task_id,
				actor: r.actor,
				createdAt: r.a.created_at.toISOString(),
			}));
		},
		notifications: (
			w: { id: string },
			args: { unread?: boolean | null },
			ctx: GraphQLContext,
		) =>
			notificationRows(
				and(
					mine(ctx, w.id),
					args.unread ? isNull(tables.notification.read_at) : undefined,
				),
			),
		unreadNotifications: (w: { id: string }, _: unknown, ctx: GraphQLContext) =>
			unreadCount(and(mine(ctx, w.id), isNull(tables.notification.read_at))),
		// The Inbox leaves out general updates, like the reference app.
		unreadInbox: (w: { id: string }, _: unknown, ctx: GraphQLContext) =>
			unreadCount(
				and(
					mine(ctx, w.id),
					isNull(tables.notification.read_at),
					ne(tables.notification.type, "update"),
				),
			),
	},
	Mutation: {
		setNotificationRead: async (
			_: unknown,
			args: { slug: string; id: string; read: boolean },
			ctx: GraphQLContext,
		) => {
			const workspace = await requireSlug(ctx, args.slug);
			const where = and(
				mine(ctx, workspace.id),
				eq(tables.notification.id, args.id),
			);
			const [updated] = await db
				.update(tables.notification)
				.set({ read_at: args.read ? new Date() : null })
				.where(where)
				.returning({ id: tables.notification.id });
			if (!updated) badInput("Notification not found");
			const [row] = await notificationRows(where);
			return row;
		},
		markAllNotificationsRead: async (
			_: unknown,
			args: { slug: string },
			ctx: GraphQLContext,
		) => {
			const workspace = await requireSlug(ctx, args.slug);
			const rows = await db
				.update(tables.notification)
				.set({ read_at: new Date() })
				.where(
					and(mine(ctx, workspace.id), isNull(tables.notification.read_at)),
				)
				.returning({ id: tables.notification.id });
			return rows.length;
		},
	},
};
