import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { db, tables } from "#/db";
import { hasRight } from "#/lib/permissions";
import { logActivity, notify } from "./activity.server";
import { requireProject } from "./projects.server";
import {
	badInput,
	forbidden,
	type GraphQLContext,
	requireUser,
} from "./schema.server";
import { cloudinary, signCloudinary } from "./settings.server";
import { requireTask } from "./tasks.server";

// Comments (with reactions and @mentions), attachments and saved views
// (reference drawer.js comments/attachments and project saved views).

type TaskRow = typeof tables.task.$inferSelect;

export const taskExtrasTypeDefs = /* GraphQL */ `
	type Reaction {
		emoji: String!
		count: Int!
		mine: Boolean!
		names: [String!]!
	}

	type TaskComment {
		id: ID!
		text: String!
		createdAt: String!
		author: Person
		authorMemberId: ID
		isMine: Boolean!
		reactions: [Reaction!]!
	}

	type Attachment {
		id: ID!
		taskId: ID!
		name: String!
		url: String!
		mime: String
		size: Int!
		uploadedBy: ID
		createdAt: String!
	}

	type SavedView {
		id: ID!
		projectId: ID!
		name: String!
		type: String!
		filters: JSON!
	}

	extend type Task {
		comments: [TaskComment!]!
		attachments: [Attachment!]!
	}

	extend type Project {
		attachments: [Attachment!]!
		savedViews: [SavedView!]!
	}

	extend type Mutation {
		addComment(slug: String!, taskId: ID!, text: String!): TaskComment!
		deleteComment(slug: String!, id: ID!): Boolean!
		reactToComment(slug: String!, id: ID!, emoji: String!): TaskComment!
		attachmentUpload(slug: String!, taskId: ID!): CloudinaryUpload!
		addAttachment(
			slug: String!
			taskId: ID!
			name: String!
			url: String!
			mime: String
			size: Int!
		): Attachment!
		removeAttachment(slug: String!, id: ID!): Boolean!
		saveView(
			slug: String!
			projectId: ID!
			name: String!
			type: String!
			filters: JSON!
		): SavedView!
		renameView(slug: String!, id: ID!, name: String!): SavedView!
		deleteView(slug: String!, id: ID!): Boolean!
	}
`;

const EMOJI = ["👍", "❤️", "🎉", "👀", "🚀", "😄", "🙏", "✅"];
const fileId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 16);

const commentRows = (where: ReturnType<typeof and>) =>
	db
		.select({
			comment: tables.comment,
			name: tables.user.name,
			email: tables.user.email,
			image: tables.user.image,
			userId: tables.user.id,
		})
		.from(tables.comment)
		.innerJoin(
			tables.workspace_members,
			eq(tables.workspace_members.id, tables.comment.author_id),
		)
		.innerJoin(
			tables.user,
			eq(tables.user.id, tables.workspace_members.user_id),
		)
		.where(where)
		.orderBy(asc(tables.comment.created_at));

const taskComments = (taskId: string) =>
	commentRows(
		and(
			eq(tables.comment.entity_type, "task"),
			eq(tables.comment.entity_id, taskId),
			isNull(tables.comment.deleted_at),
		),
	);

/** Comment rows shaped for GraphQL, with reactions resolved to people's names. */
async function shape(
	rows: Awaited<ReturnType<typeof commentRows>>,
	viewerUserId: string,
) {
	const reactorIds = [
		...new Set(
			rows.flatMap((r) =>
				Object.values(
					(r.comment.reactions ?? {}) as Record<string, string[]>,
				).flat(),
			),
		),
	];
	const people = reactorIds.length
		? await db
				.select({
					memberId: tables.workspace_members.id,
					name: tables.user.name,
					userId: tables.user.id,
				})
				.from(tables.workspace_members)
				.innerJoin(
					tables.user,
					eq(tables.user.id, tables.workspace_members.user_id),
				)
				.where(inArray(tables.workspace_members.id, reactorIds))
		: [];
	const nameOf = new Map(people.map((p) => [p.memberId, p]));
	return rows.map((r) => {
		const reactions = (r.comment.reactions ?? {}) as Record<string, string[]>;
		return {
			id: r.comment.id,
			text: r.comment.content,
			createdAt: r.comment.created_at.toISOString(),
			author: { id: r.userId, name: r.name, email: r.email, image: r.image },
			authorMemberId: r.comment.author_id,
			isMine: r.userId === viewerUserId,
			reactions: Object.entries(reactions)
				.filter(([, ids]) => ids.length)
				.map(([emoji, ids]) => ({
					emoji,
					count: ids.length,
					mine: ids.some((id) => nameOf.get(id)?.userId === viewerUserId),
					names: ids.map((id) => nameOf.get(id)?.name ?? "Someone"),
				})),
		};
	});
}

async function oneComment(id: string, viewerUserId: string) {
	const [comment] = await shape(
		await commentRows(eq(tables.comment.id, id)),
		viewerUserId,
	);
	if (!comment) badInput("Comment not found");
	return comment;
}

/** The comment and its task, checked against the viewer's rights on the project. */
async function requireComment(ctx: GraphQLContext, slug: string, id: string) {
	const [comment] = await db
		.select()
		.from(tables.comment)
		.where(and(eq(tables.comment.id, id), isNull(tables.comment.deleted_at)));
	if (!comment || comment.entity_type !== "task") badInput("Comment not found");
	return {
		comment,
		...(await requireTask(ctx, slug, comment.entity_id, "comment")),
	};
}

/** Assignee, earlier commenters and @mentioned people hear about a new comment. */
async function notifyComment(
	workspaceId: string,
	actorUserId: string,
	task: TaskRow,
	text: string,
) {
	const people = await db
		.select({
			memberId: tables.workspace_members.id,
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
			),
		);
	const mentioned = new Set(
		people.filter((p) => text.includes(`@${p.name}`)).map((p) => p.userId),
	);
	const [assignee] = await db
		.select({ memberId: tables.task_assignees.member_id })
		.from(tables.task_assignees)
		.where(
			and(
				eq(tables.task_assignees.task_id, task.id),
				isNull(tables.task_assignees.deleted_at),
			),
		);
	const earlier = await db
		.select({ memberId: tables.comment.author_id })
		.from(tables.comment)
		.where(
			and(
				eq(tables.comment.entity_type, "task"),
				eq(tables.comment.entity_id, task.id),
			),
		);
	const followers = new Set(
		[assignee?.memberId, ...earlier.map((c) => c.memberId)]
			.map((id) => people.find((p) => p.memberId === id)?.userId)
			.filter((id): id is string => !!id),
	);
	const snippet = text.slice(0, 200);
	const base = {
		workspace_id: workspaceId,
		actor_id: actorUserId,
		snippet,
		task_id: task.id,
		project_id: task.project_id,
	};
	await notify(db, [
		...[...mentioned]
			.filter((id) => id !== actorUserId)
			.map((user_id) => ({
				...base,
				user_id,
				type: "mention",
				text: "mentioned you in",
			})),
		...[...followers]
			.filter((id) => id !== actorUserId && !mentioned.has(id))
			.map((user_id) => ({
				...base,
				user_id,
				type: "comment",
				text: "commented on",
			})),
	]);
}

const attachmentShape = (a: typeof tables.task_attachment.$inferSelect) => ({
	id: a.id,
	taskId: a.task_id,
	name: a.name,
	url: a.url,
	mime: a.mime,
	size: a.size,
	uploadedBy: a.uploaded_by,
	createdAt: a.created_at.toISOString(),
});

const viewShape = (v: typeof tables.saved_view.$inferSelect) => ({
	id: v.id,
	projectId: v.project_id,
	name: v.name,
	type: v.type,
	filters: v.filters,
});

const VIEW_TYPES = z.enum(["list", "board", "table"]);
const VIEW_NAME = z.string().trim().min(1, "Name the view").max(100);
// filters are { f, op, v[] } rows (reference view engine)
const FILTERS = z
	.array(
		z.object({
			f: z.string().max(20),
			op: z.enum(["is", "not"]),
			v: z.array(z.string().max(40)).max(50),
		}),
	)
	.max(20);

export const taskExtrasResolvers = {
	Task: {
		comments: async (t: TaskRow, _: unknown, ctx: GraphQLContext) =>
			shape(await taskComments(t.id), requireUser(ctx).id),
		attachments: (t: TaskRow) =>
			db
				.select()
				.from(tables.task_attachment)
				.where(
					and(
						eq(tables.task_attachment.task_id, t.id),
						isNull(tables.task_attachment.deleted_at),
					),
				)
				.orderBy(asc(tables.task_attachment.created_at))
				.then((rows) => rows.map(attachmentShape)),
	},
	Project: {
		// every file on the project's tasks (Files tab)
		attachments: (p: { id: string }) =>
			db
				.select({ a: tables.task_attachment })
				.from(tables.task_attachment)
				.innerJoin(
					tables.task,
					eq(tables.task.id, tables.task_attachment.task_id),
				)
				.where(
					and(
						eq(tables.task.project_id, p.id),
						isNull(tables.task.deleted_at),
						isNull(tables.task_attachment.deleted_at),
					),
				)
				.orderBy(asc(tables.task_attachment.created_at))
				.then((rows) => rows.map((r) => attachmentShape(r.a))),
		savedViews: (p: { id: string }) =>
			db
				.select()
				.from(tables.saved_view)
				.where(
					and(
						eq(tables.saved_view.project_id, p.id),
						isNull(tables.saved_view.deleted_at),
					),
				)
				.orderBy(asc(tables.saved_view.created_at))
				.then((rows) => rows.map(viewShape)),
	},
	Mutation: {
		addComment: async (
			_: unknown,
			args: { slug: string; taskId: string; text: string },
			ctx: GraphQLContext,
		) => {
			const text = args.text.trim();
			if (!text) badInput("Write a comment first");
			if (text.length > 10_000)
				badInput("Keep comments under 10,000 characters");
			const { user, workspace, task } = await requireTask(
				ctx,
				args.slug,
				args.taskId,
				"comment",
			);
			const [row] = await db
				.insert(tables.comment)
				.values({
					entity_type: "task",
					entity_id: task.id,
					author_id: workspace.memberId ?? "",
					content: text,
				})
				.returning({ id: tables.comment.id });
			if (!row) throw new Error("Comment insert returned nothing");
			await logActivity(db, {
				workspace_id: workspace.id,
				actor_id: user.id,
				kind: "task",
				verb: "commented on",
				target: task.name,
				project_id: task.project_id,
				task_id: task.id,
			});
			await notifyComment(workspace.id, user.id, task, text);
			return oneComment(row.id, user.id);
		},

		deleteComment: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const { comment, workspace, right } = await requireComment(
				ctx,
				args.slug,
				args.id,
			);
			// your own comments, or anyone's with full access to the project
			if (comment.author_id !== workspace.memberId && !hasRight(right, "full"))
				forbidden();
			await db
				.update(tables.comment)
				.set({ deleted_at: new Date() })
				.where(eq(tables.comment.id, comment.id));
			return true;
		},

		reactToComment: async (
			_: unknown,
			args: { slug: string; id: string; emoji: string },
			ctx: GraphQLContext,
		) => {
			if (!EMOJI.includes(args.emoji)) badInput("Pick one of the reactions");
			const { comment, workspace, user } = await requireComment(
				ctx,
				args.slug,
				args.id,
			);
			const me = workspace.memberId ?? "";
			const reactions = {
				...((comment.reactions ?? {}) as Record<string, string[]>),
			};
			const list = reactions[args.emoji] ?? [];
			reactions[args.emoji] = list.includes(me)
				? list.filter((id) => id !== me)
				: [...list, me];
			await db
				.update(tables.comment)
				.set({ reactions })
				.where(eq(tables.comment.id, comment.id));
			return oneComment(comment.id, user.id);
		},

		attachmentUpload: async (
			_: unknown,
			args: { slug: string; taskId: string },
			ctx: GraphQLContext,
		) => {
			const { task } = await requireTask(ctx, args.slug, args.taskId, "edit");
			const { cloud, key, secret } = cloudinary();
			const params = {
				folder: `zadaci/tasks/${task.id}`,
				public_id: fileId(),
				timestamp: Math.floor(Date.now() / 1000),
			};
			return {
				url: `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`,
				apiKey: key,
				timestamp: params.timestamp,
				signature: signCloudinary(params, secret),
				publicId: params.public_id,
				folder: params.folder,
			};
		},

		addAttachment: async (
			_: unknown,
			args: {
				slug: string;
				taskId: string;
				name: string;
				url: string;
				mime?: string | null;
				size: number;
			},
			ctx: GraphQLContext,
		) => {
			const { user, workspace, task } = await requireTask(
				ctx,
				args.slug,
				args.taskId,
				"edit",
			);
			const { cloud } = cloudinary();
			// only files we signed for this task: our Cloudinary account and this task's folder
			if (
				!args.url.startsWith(`https://res.cloudinary.com/${cloud}/`) ||
				!args.url.includes(`/zadaci/tasks/${task.id}/`)
			)
				badInput("That file didn't come from this task's upload");
			const name = z.string().trim().min(1).max(255).safeParse(args.name);
			if (!name.success) badInput("The file needs a name");
			const [row] = await db
				.insert(tables.task_attachment)
				.values({
					task_id: task.id,
					name: name.data,
					url: args.url,
					mime: args.mime?.slice(0, 120) ?? null,
					size: Math.max(0, Math.min(args.size, 2 ** 31 - 1)),
					uploaded_by: workspace.memberId ?? null,
				})
				.returning();
			if (!row) throw new Error("Attachment insert returned nothing");
			await logActivity(db, {
				workspace_id: workspace.id,
				actor_id: user.id,
				kind: "task",
				verb: "added a file to",
				target: task.name,
				extra: name.data,
				project_id: task.project_id,
				task_id: task.id,
			});
			return attachmentShape(row);
		},

		removeAttachment: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const [file] = await db
				.select()
				.from(tables.task_attachment)
				.where(
					and(
						eq(tables.task_attachment.id, args.id),
						isNull(tables.task_attachment.deleted_at),
					),
				);
			if (!file) badInput("File not found");
			const { user, workspace, task } = await requireTask(
				ctx,
				args.slug,
				file.task_id,
				"edit",
			);
			await db
				.update(tables.task_attachment)
				.set({ deleted_at: new Date() })
				.where(eq(tables.task_attachment.id, file.id));
			await logActivity(db, {
				workspace_id: workspace.id,
				actor_id: user.id,
				kind: "task",
				verb: "removed a file from",
				target: task.name,
				project_id: task.project_id,
				task_id: task.id,
			});
			return true;
		},

		saveView: async (
			_: unknown,
			args: {
				slug: string;
				projectId: string;
				name: string;
				type: string;
				filters: unknown;
			},
			ctx: GraphQLContext,
		) => {
			const { workspace, project } = await requireProject(
				ctx,
				args.slug,
				args.projectId,
				{
					right: "edit",
				},
			);
			const [row] = await db
				.insert(tables.saved_view)
				.values({
					project_id: project.id,
					name: parseOr(VIEW_NAME, args.name),
					type: parseOr(VIEW_TYPES, args.type),
					filters: parseOr(FILTERS, args.filters),
					created_by: workspace.memberId ?? null,
				})
				.returning();
			if (!row) throw new Error("View insert returned nothing");
			return viewShape(row);
		},

		renameView: async (
			_: unknown,
			args: { slug: string; id: string; name: string },
			ctx: GraphQLContext,
		) => {
			const view = await requireView(ctx, args.slug, args.id);
			const [row] = await db
				.update(tables.saved_view)
				.set({ name: parseOr(VIEW_NAME, args.name) })
				.where(eq(tables.saved_view.id, view.id))
				.returning();
			if (!row) badInput("View not found");
			return viewShape(row);
		},

		deleteView: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const view = await requireView(ctx, args.slug, args.id);
			await db
				.update(tables.saved_view)
				.set({ deleted_at: new Date() })
				.where(eq(tables.saved_view.id, view.id));
			return true;
		},
	},
};

function parseOr<T>(schema: z.ZodType<T>, value: unknown): T {
	const result = schema.safeParse(value);
	if (!result.success)
		badInput(result.error.issues[0]?.message ?? "Invalid input");
	return result.data;
}

async function requireView(ctx: GraphQLContext, slug: string, id: string) {
	const [view] = await db
		.select()
		.from(tables.saved_view)
		.where(
			and(eq(tables.saved_view.id, id), isNull(tables.saved_view.deleted_at)),
		);
	if (!view) badInput("View not found");
	await requireProject(ctx, slug, view.project_id, { right: "edit" });
	return view;
}
