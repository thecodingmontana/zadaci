import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { db, tables } from "#/db";
import { isEmoji } from "#/lib/emoji";
import { isUploadUrl, MAX_BYTES } from "#/lib/files";
import { hasRight } from "#/lib/permissions";
import { taskKey } from "#/lib/tasks";
import { logActivity, notify } from "./activity.server";
import { requireNote } from "./notes.server";
import { projectAudience, requireProject } from "./projects.server";
import {
	badInput,
	findWorkspaces,
	forbidden,
	type GraphQLContext,
	requireUser,
} from "./schema.server";
import { cloudinary, signCloudinary } from "./settings.server";
import { requireTask } from "./tasks.server";

// Comments (with reactions and @mentions), attachments and saved views
// (reference drawer.js comments/attachments and project saved views).

type TaskRow = typeof tables.task.$inferSelect;
type Q = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// a timer left running counts for 12 hours at most
const MAX_TIMER = sql`interval '12 hours'`;
const stopRunning = (q: Q, memberId: string) =>
	q
		.update(tables.time_entry)
		.set({
			ended_at: sql`least(now(), ${tables.time_entry.started_at} + ${MAX_TIMER})`,
		})
		.where(
			and(
				eq(tables.time_entry.member_id, memberId),
				isNull(tables.time_entry.ended_at),
			),
		);

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
		"note comments: the passage it's about, the comment it replies to, and whether it's resolved"
		quote: String
		parentId: ID
		resolved: Boolean!
	}

	type Attachment {
		id: ID!
		projectId: ID!
		taskId: ID
		"the task key when the file is on a task"
		taskKey: String
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
		"seconds logged on the task by everyone, the running timers included"
		timeSpent: Int!
		"when the viewer's own timer on this task started, while it runs"
		myTimerStartedAt: String
	}

	extend type Project {
		attachments: [Attachment!]!
		savedViews: [SavedView!]!
	}

	extend type Mutation {
		"starts the viewer's timer on a task (stopping any other one of theirs)"
		startTimer(slug: String!, taskId: ID!): Boolean!
		"stops the viewer's running timer"
		stopTimer(slug: String!): Boolean!
		addComment(slug: String!, taskId: ID!, text: String!): TaskComment!
		deleteComment(slug: String!, id: ID!): Boolean!
		reactToComment(slug: String!, id: ID!, emoji: String!): TaskComment!
		"upload slot for a task file, or a project file when taskId is left out"
		attachmentUpload(slug: String!, taskId: ID, projectId: ID): CloudinaryUpload!
		addAttachment(
			slug: String!
			taskId: ID
			projectId: ID
			name: String!
			url: String!
			mime: String
			size: Int!
		): Attachment!
		renameAttachment(slug: String!, id: ID!, name: String!): Attachment!
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

/** Different emoji one comment can collect, so reactions never pile data onto it. */
const MAX_REACTIONS = 20;
const fileId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 16);

export const commentRows = (where: ReturnType<typeof and>) =>
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
export async function shape(
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
			quote: (r.comment.anchor as { quote?: string } | null)?.quote ?? null,
			parentId: r.comment.parent_id,
			resolved: !!r.comment.resolved_at,
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

export async function oneComment(id: string, viewerUserId: string) {
	const [comment] = await shape(
		await commentRows(eq(tables.comment.id, id)),
		viewerUserId,
	);
	if (!comment) badInput("Comment not found");
	return comment;
}

/** The comment and its task or note, checked against the viewer's rights on it. */
async function requireComment(ctx: GraphQLContext, slug: string, id: string) {
	const [comment] = await db
		.select()
		.from(tables.comment)
		.where(and(eq(tables.comment.id, id), isNull(tables.comment.deleted_at)));
	if (comment?.entity_type === "note")
		return {
			comment,
			...(await requireNote(ctx, slug, comment.entity_id, "comment")),
		};
	if (comment?.entity_type !== "task") badInput("Comment not found");
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
	const everyone = await db
		.select({
			memberId: tables.workspace_members.id,
			userId: tables.user.id,
			name: tables.user.name,
			role: tables.workspace_members.role,
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
	// only people who can see the project hear about it: the snippet quotes the comment
	const sees = await projectAudience(task.project_id);
	const people = everyone.filter(sees);
	const mentioned = new Set(
		people.filter((p) => text.includes(`@${p.name}`)).map((p) => p.userId),
	);
	// every assignee follows their task
	const assignees = await db
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
		[...assignees, ...earlier]
			.map((r) => r.memberId)
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

const attachmentShape = (
	a: typeof tables.task_attachment.$inferSelect,
	taskKey: string | null = null,
) => ({
	id: a.id,
	projectId: a.project_id,
	taskId: a.task_id,
	taskKey,
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

/**
 * Cloudinary can't cap the size of a signed upload, so the file's real size is checked once it's
 * there; one over the limit for its kind is deleted and not recorded.
 * shortcut: a file uploaded but never recorded isn't checked; sweep the folders on a schedule if
 * storage abuse ever shows up.
 */
/** A just-uploaded file over its size limit is deleted again and refused. */
export async function checkUploadedSize(url: string) {
	const { cloud, key, secret } = cloudinary();
	const [, , kind, , ...rest] = new URL(url).pathname.split("/");
	const resourceType = kind === "image" || kind === "video" ? kind : "raw";
	const head = await fetch(url, { method: "HEAD" }).catch(() => null);
	const bytes = Number(head?.headers.get("content-length") ?? Number.NaN);
	if (head?.ok && bytes <= MAX_BYTES[resourceType]) return;
	// the public id is the path after the version, without the extension (raw files keep it)
	const path = rest.filter((p, i) => !(i === 0 && /^v\d+$/.test(p))).join("/");
	const publicId =
		resourceType === "raw" ? path : path.replace(/\.[^./]+$/, "");
	const timestamp = Math.floor(Date.now() / 1000);
	const form = new FormData();
	form.set("public_id", publicId);
	form.set("timestamp", String(timestamp));
	form.set("api_key", key);
	form.set(
		"signature",
		signCloudinary({ public_id: publicId, timestamp }, secret),
	);
	await fetch(
		`https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/destroy`,
		{
			method: "POST",
			body: form,
		},
	).catch(() => {});
	badInput(
		head?.ok
			? `That file is over ${MAX_BYTES[resourceType] / 1024 / 1024} MB, the limit for this kind of file`
			: "Couldn't check that file. Try uploading it again.",
	);
}

export const taskExtrasResolvers = {
	Task: {
		// shortcut: one query per task; only the task drawer asks for these, batch them before lists do
		timeSpent: async (t: TaskRow) => {
			const [row] = await db
				.select({
					s: sql<number>`coalesce(sum(extract(epoch from coalesce(${tables.time_entry.ended_at}, now()) - ${tables.time_entry.started_at})), 0)::int`,
				})
				.from(tables.time_entry)
				.where(eq(tables.time_entry.task_id, t.id));
			return row?.s ?? 0;
		},
		myTimerStartedAt: async (t: TaskRow, _: unknown, ctx: GraphQLContext) => {
			const [row] = await db
				.select({ at: tables.time_entry.started_at })
				.from(tables.time_entry)
				.innerJoin(
					tables.workspace_members,
					eq(tables.workspace_members.id, tables.time_entry.member_id),
				)
				.where(
					and(
						eq(tables.time_entry.task_id, t.id),
						isNull(tables.time_entry.ended_at),
						eq(tables.workspace_members.user_id, requireUser(ctx).id),
					),
				);
			return row?.at.toISOString() ?? null;
		},
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
				.then((rows) => rows.map((r) => attachmentShape(r))),
	},
	Project: {
		// every file on the project's tasks (Files tab)
		attachments: (p: { id: string; key?: string }) =>
			db
				.select({
					a: tables.task_attachment,
					number: tables.task.number,
					taskDeleted: tables.task.deleted_at,
				})
				.from(tables.task_attachment)
				.leftJoin(
					tables.task,
					eq(tables.task.id, tables.task_attachment.task_id),
				)
				.where(
					and(
						eq(tables.task_attachment.project_id, p.id),
						isNull(tables.task_attachment.deleted_at),
					),
				)
				.orderBy(asc(tables.task_attachment.created_at))
				.then((rows) =>
					rows
						.filter((r) => !r.taskDeleted)
						.map((r) =>
							attachmentShape(
								r.a,
								r.number && p.key ? taskKey(p.key, r.number) : null,
							),
						),
				),
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
		startTimer: async (
			_: unknown,
			args: { slug: string; taskId: string },
			ctx: GraphQLContext,
		) => {
			const { workspace, task } = await requireTask(
				ctx,
				args.slug,
				args.taskId,
				"edit",
			);
			const member = workspace.memberId ?? "";
			await db.transaction(async (tx) => {
				await stopRunning(tx, member);
				await tx
					.insert(tables.time_entry)
					.values({ task_id: task.id, member_id: member });
			});
			return true;
		},
		stopTimer: async (
			_: unknown,
			args: { slug: string },
			ctx: GraphQLContext,
		) => {
			const [workspace] = await findWorkspaces(requireUser(ctx).id, args.slug);
			if (!workspace) badInput("Workspace not found");
			await stopRunning(db, workspace.memberId ?? "");
			return true;
		},
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
			if (!isEmoji(args.emoji)) badInput("Pick an emoji");
			const { comment, workspace, user } = await requireComment(
				ctx,
				args.slug,
				args.id,
			);
			const used = Object.entries(
				(comment.reactions ?? {}) as Record<string, string[]>,
			).filter(([, ids]) => ids.length > 0);
			if (
				!used.some(([emoji]) => emoji === args.emoji) &&
				used.length >= MAX_REACTIONS
			)
				badInput(
					`A comment can have up to ${MAX_REACTIONS} different reactions`,
				);
			const me = workspace.memberId ?? "";
			const list = sql`coalesce(${tables.comment.reactions} -> ${args.emoji}::text, '[]'::jsonb)`;
			// toggled in one statement, so two people reacting at once both count
			await db
				.update(tables.comment)
				.set({
					reactions: sql`jsonb_set(${tables.comment.reactions}, array[${args.emoji}::text], case when ${list} ? ${me}::text then ${list} - ${me}::text else ${list} || to_jsonb(${me}::text) end)`,
				})
				.where(eq(tables.comment.id, comment.id));
			return oneComment(comment.id, user.id);
		},

		attachmentUpload: async (
			_: unknown,
			args: { slug: string; taskId?: string | null; projectId?: string | null },
			ctx: GraphQLContext,
		) => {
			const target = await fileTarget(ctx, args.slug, args);
			const { cloud, key, secret } = cloudinary();
			const params = {
				folder: target.folder,
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
				taskId?: string | null;
				projectId?: string | null;
				name: string;
				url: string;
				mime?: string | null;
				size: number;
			},
			ctx: GraphQLContext,
		) => {
			const target = await fileTarget(ctx, args.slug, args);
			const { cloud } = cloudinary();
			// only files we signed a slot for: our Cloudinary account and this task or project folder
			if (!isUploadUrl(args.url, cloud, target.folder))
				badInput("That file didn't come from this upload");
			await checkUploadedSize(args.url);
			const name = z.string().trim().min(1).max(255).safeParse(args.name);
			if (!name.success) badInput("The file needs a name");
			const [row] = await db
				.insert(tables.task_attachment)
				.values({
					project_id: target.projectId,
					task_id: target.task?.id ?? null,
					name: name.data,
					url: args.url,
					mime: args.mime?.slice(0, 120) ?? null,
					size: Math.max(0, Math.min(args.size, 2 ** 31 - 1)),
					uploaded_by: target.workspace.memberId ?? null,
				})
				.returning();
			if (!row) throw new Error("Attachment insert returned nothing");
			await logActivity(db, {
				workspace_id: target.workspace.id,
				actor_id: target.userId,
				kind: target.task ? "task" : "project",
				verb: target.task ? "added a file to" : "uploaded a file to",
				target: target.task?.name ?? target.projectTitle,
				extra: name.data,
				project_id: target.projectId,
				task_id: target.task?.id ?? null,
			});
			return attachmentShape(row);
		},

		renameAttachment: async (
			_: unknown,
			args: { slug: string; id: string; name: string },
			ctx: GraphQLContext,
		) => {
			const file = await requireFile(ctx, args.slug, args.id);
			const name = z
				.string()
				.trim()
				.min(1, "The file needs a name")
				.max(255)
				.safeParse(args.name);
			if (!name.success)
				badInput(name.error.issues[0]?.message ?? "Invalid name");
			const [row] = await db
				.update(tables.task_attachment)
				.set({ name: name.data })
				.where(eq(tables.task_attachment.id, file.id))
				.returning();
			if (!row) badInput("File not found");
			return attachmentShape(row);
		},

		removeAttachment: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const file = await requireFile(ctx, args.slug, args.id);
			await db
				.update(tables.task_attachment)
				.set({ deleted_at: new Date() })
				.where(eq(tables.task_attachment.id, file.id));
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

/** Where an upload goes: a task you can edit, or a project you can edit. */
async function fileTarget(
	ctx: GraphQLContext,
	slug: string,
	args: { taskId?: string | null; projectId?: string | null },
) {
	if (args.taskId) {
		const { user, workspace, task } = await requireTask(
			ctx,
			slug,
			args.taskId,
			"edit",
		);
		return {
			userId: user.id,
			workspace,
			task,
			projectId: task.project_id,
			projectTitle: "",
			folder: `zadaci/tasks/${task.id}`,
		};
	}
	if (!args.projectId) badInput("Pick a task or a project for the file");
	const { user, workspace, project } = await requireProject(
		ctx,
		slug,
		args.projectId,
		{
			right: "edit",
		},
	);
	return {
		userId: user.id,
		workspace,
		task: null,
		projectId: project.id,
		projectTitle: project.title,
		folder: `zadaci/projects/${project.id}`,
	};
}

/** A file in a project the viewer can edit. */
async function requireFile(ctx: GraphQLContext, slug: string, id: string) {
	const [file] = await db
		.select()
		.from(tables.task_attachment)
		.where(
			and(
				eq(tables.task_attachment.id, id),
				isNull(tables.task_attachment.deleted_at),
			),
		);
	if (!file) badInput("File not found");
	await requireProject(ctx, slug, file.project_id, { right: "edit" });
	return file;
}
