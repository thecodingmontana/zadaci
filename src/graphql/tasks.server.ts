import {
	and,
	asc,
	count,
	desc,
	eq,
	inArray,
	isNull,
	max,
	type SQL,
	sql,
} from "drizzle-orm";
import { z } from "zod";
import { db, tables } from "#/db";
import { PRIORITY, STATUS } from "#/db/enums";
import type { ProjectRight } from "#/lib/permissions";
import { fromDay, toDay } from "#/lib/projects";
import {
	ESTIMATES,
	LABEL_IDS,
	PRIORITIES,
	priority as priorityOf,
	RECUR_DAYS,
	RECURS,
	TASK_STATUSES,
	taskKey,
	taskStatus,
} from "#/lib/tasks";
import { fmtDay } from "#/lib/time";
import { logActivity, notify } from "./activity.server";
import { requireProject } from "./projects.server";
import {
	badInput,
	type findWorkspaces,
	type GraphQLContext,
	projectScope,
	requireUser,
} from "./schema.server";

// Tasks (reference actions.js createTask / updateTask / applyPatch): the rows every task view
// reads, and every change those views make. Reading needs view rights on the project,
// changing needs edit rights (see src/lib/permissions.ts projectRight).

type TaskRow = typeof tables.task.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Workspace = Awaited<ReturnType<typeof findWorkspaces>>[number];

export const tasksTypeDefs = /* GraphQL */ `
	extend type Task {
		"short code, e.g. WEB-12"
		key: String!
		number: Int!
		projectId: ID!
		parentId: ID
		description: String
		assigneeId: ID
		"YYYY-MM-DD"
		startDate: String
		labels: [String!]!
		estimate: String
		recur: String
		sortOrder: Float!
		completedAt: String
		archivedAt: String
		createdAt: String!
		updatedAt: String!
		isFavorite: Boolean!
		subtaskCount: Int!
		subtaskDone: Int!
		commentCount: Int!
		attachmentCount: Int!
		"tasks this one is blocked by"
		dependsOn: [ID!]!
		subtasks: [Task!]!
	}

	input TaskInput {
		projectId: ID!
		title: String!
		parentId: ID
		status: String
		priority: String
		assigneeId: ID
		dueDate: String
		startDate: String
		labels: [String!]
		description: String
		estimate: String
		recur: String
	}

	input TaskPatch {
		title: String
		description: String
		status: String
		priority: String
		assigneeId: ID
		dueDate: String
		startDate: String
		labels: [String!]
		estimate: String
		recur: String
		projectId: ID
		sortOrder: Float
	}

	extend type Workspace {
		"top-level tasks in projects the viewer can see"
		tasks(projectId: ID, assigneeId: ID, includeArchived: Boolean): [Task!]!
		task(id: ID!): Task
	}

	extend type Mutation {
		createTask(slug: String!, input: TaskInput!): Task!
		updateTask(slug: String!, id: ID!, patch: TaskPatch!): Task!
		bulkUpdateTasks(slug: String!, ids: [ID!]!, patch: TaskPatch!): Int!
		deleteTasks(slug: String!, ids: [ID!]!): Int!
		archiveTask(slug: String!, id: ID!, archived: Boolean!): Task!
		duplicateTask(slug: String!, id: ID!): Task!
		setDependencies(slug: String!, id: ID!, dependsOn: [ID!]!): Task!
		toggleTaskFavorite(slug: String!, id: ID!): Boolean!
	}
`;

const DAY = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-31");
const STATUS_IDS: [string, ...string[]] = [
	"abandoned",
	...TASK_STATUSES.map((s) => s.id),
];
const PRIORITY_IDS = PRIORITIES.map((p) => p.id) as [string, ...string[]];
const fields = {
	title: z.string().trim().min(1, "Give the task a name").max(500),
	description: z.string().max(50_000).nullish(),
	status: z.enum(STATUS_IDS).nullish(),
	priority: z.enum(PRIORITY_IDS).nullish(),
	assigneeId: z.string().nullish(),
	dueDate: DAY.nullish(),
	startDate: DAY.nullish(),
	labels: z
		.array(z.enum(LABEL_IDS as [string, ...string[]]))
		.max(8)
		.nullish(),
	estimate: z.enum(ESTIMATES as [string, ...string[]]).nullish(),
	recur: z.enum(RECURS as [string, ...string[]]).nullish(),
};
const taskInput = z.object({
	...fields,
	projectId: z.string(),
	parentId: z.string().nullish(),
});
const taskPatch = z
	.object({ ...fields, projectId: z.string(), sortOrder: z.number().finite() })
	.partial();
type Patch = z.infer<typeof taskPatch>;

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
	const result = schema.safeParse(value);
	if (!result.success)
		badInput(result.error.issues[0]?.message ?? "Invalid input");
	return result.data;
}

// ---- reading -------------------------------------------------------------

type Enriched = TaskRow & {
	projectKey: string;
	assigneeId: string | null;
	isFavorite: boolean;
	subtaskCount: number;
	subtaskDone: number;
	commentCount: number;
	attachmentCount: number;
	dependsOn: string[];
};

/** Task rows plus everything the views show, fetched in a handful of grouped queries. */
export async function enrichTasks(
	where: SQL | undefined,
	viewerUserId: string,
	order: "sort" | "created" = "sort",
): Promise<Enriched[]> {
	const rows = await db
		.select({ task: tables.task, projectKey: tables.project.key })
		.from(tables.task)
		.innerJoin(tables.project, eq(tables.project.id, tables.task.project_id))
		.where(
			and(
				isNull(tables.task.deleted_at),
				isNull(tables.project.deleted_at),
				where,
			),
		)
		.orderBy(
			order === "sort"
				? asc(tables.task.sort_order)
				: asc(tables.task.created_at),
			asc(tables.task.number),
		);
	if (!rows.length) return [];
	const ids = rows.map((r) => r.task.id);
	const [assignees, subtasks, comments, files, deps, favorites] =
		await Promise.all([
			db
				.select({
					taskId: tables.task_assignees.task_id,
					memberId: tables.task_assignees.member_id,
				})
				.from(tables.task_assignees)
				.where(
					and(
						inArray(tables.task_assignees.task_id, ids),
						isNull(tables.task_assignees.deleted_at),
					),
				)
				.orderBy(desc(tables.task_assignees.assigned_at)),
			db
				.select({
					parentId: tables.task.parent_task_id,
					n: count(),
					done: sql<number>`count(*) filter (where ${tables.task.status} = 'completed')`.mapWith(
						Number,
					),
				})
				.from(tables.task)
				.where(
					and(
						inArray(tables.task.parent_task_id, ids),
						isNull(tables.task.deleted_at),
					),
				)
				.groupBy(tables.task.parent_task_id),
			db
				.select({ taskId: tables.comment.entity_id, n: count() })
				.from(tables.comment)
				.where(
					and(
						eq(tables.comment.entity_type, "task"),
						inArray(tables.comment.entity_id, ids),
						isNull(tables.comment.deleted_at),
					),
				)
				.groupBy(tables.comment.entity_id),
			db
				.select({ taskId: tables.task_attachment.task_id, n: count() })
				.from(tables.task_attachment)
				.where(
					and(
						inArray(tables.task_attachment.task_id, ids),
						isNull(tables.task_attachment.deleted_at),
					),
				)
				.groupBy(tables.task_attachment.task_id),
			db
				.select({
					taskId: tables.task_dependency.task_id,
					dependsOn: tables.task_dependency.depends_on_id,
				})
				.from(tables.task_dependency)
				.where(inArray(tables.task_dependency.task_id, ids)),
			db
				.select({ taskId: tables.favorite.entity_id })
				.from(tables.favorite)
				.where(
					and(
						eq(tables.favorite.user_id, viewerUserId),
						eq(tables.favorite.entity_type, "task"),
						inArray(tables.favorite.entity_id, ids),
					),
				),
		]);
	const by = <T extends { taskId: string }>(list: T[]) => {
		const map = new Map<string, T[]>();
		for (const item of list)
			map.set(item.taskId, [...(map.get(item.taskId) ?? []), item]);
		return map;
	};
	const assigneeMap = by(assignees);
	const commentMap = by(comments);
	const fileMap = by(files);
	const depMap = by(deps);
	const favs = new Set(favorites.map((f) => f.taskId));
	return rows.map(({ task, projectKey }) => {
		const sub = subtasks.find((s) => s.parentId === task.id);
		return {
			...task,
			projectKey,
			assigneeId: assigneeMap.get(task.id)?.[0]?.memberId ?? null,
			isFavorite: favs.has(task.id),
			subtaskCount: sub?.n ?? 0,
			subtaskDone: sub?.done ?? 0,
			commentCount: commentMap.get(task.id)?.[0]?.n ?? 0,
			attachmentCount: fileMap.get(task.id)?.[0]?.n ?? 0,
			dependsOn: (depMap.get(task.id) ?? []).map((d) => d.dependsOn),
		};
	});
}

async function enrichOne(taskId: string, viewerUserId: string) {
	const [task] = await enrichTasks(eq(tables.task.id, taskId), viewerUserId);
	if (!task) throw new Error("Task disappeared");
	return task;
}

/** A task the viewer can see in this workspace, with their right on its project. */
export async function requireTask(
	ctx: GraphQLContext,
	slug: string,
	taskId: string,
	right: ProjectRight = "view",
) {
	const user = requireUser(ctx);
	const [row] = await db
		.select({ projectId: tables.task.project_id })
		.from(tables.task)
		.where(and(eq(tables.task.id, taskId), isNull(tables.task.deleted_at)));
	if (!row) badInput("Task not found");
	const found = await requireProject(ctx, slug, row.projectId, { right });
	const [task] = await db
		.select()
		.from(tables.task)
		.where(eq(tables.task.id, taskId));
	if (!task) badInput("Task not found");
	return { ...found, user, task };
}

// ---- changing --------------------------------------------------------------

const memberName = async (memberId: string) => {
	const [m] = await db
		.select({ name: tables.user.name, userId: tables.user.id })
		.from(tables.workspace_members)
		.innerJoin(
			tables.user,
			eq(tables.user.id, tables.workspace_members.user_id),
		)
		.where(eq(tables.workspace_members.id, memberId));
	return m;
};

/** Next key number in a project, taken atomically. */
async function nextNumber(q: Tx | typeof db, projectId: string) {
	const [row] = await q
		.update(tables.project)
		.set({ task_seq: sql`${tables.project.task_seq} + 1` })
		.where(eq(tables.project.id, projectId))
		.returning({ n: tables.project.task_seq });
	return row?.n ?? 1;
}

async function setAssignee(
	q: Tx | typeof db,
	taskId: string,
	memberId: string | null,
) {
	await q
		.update(tables.task_assignees)
		.set({ deleted_at: new Date() })
		.where(
			and(
				eq(tables.task_assignees.task_id, taskId),
				isNull(tables.task_assignees.deleted_at),
			),
		);
	if (memberId)
		await q.insert(tables.task_assignees).values({
			task_id: taskId,
			member_id: memberId,
			assigned_at: new Date(),
		});
}

async function checkAssignee(
	workspaceId: string,
	memberId: string | null | undefined,
) {
	if (!memberId) return;
	const [m] = await db
		.select({ id: tables.workspace_members.id })
		.from(tables.workspace_members)
		.where(
			and(
				eq(tables.workspace_members.id, memberId),
				eq(tables.workspace_members.workspace_id, workspaceId),
				isNull(tables.workspace_members.deleted_at),
			),
		);
	if (!m) badInput("The assignee must be someone in this workspace");
}

type Actor = { workspace: Workspace; userId: string };

const taskActivity = (
	actor: Actor,
	task: TaskRow,
	verb: string,
	extra?: string,
	q: Tx | typeof db = db,
) =>
	logActivity(q, {
		workspace_id: actor.workspace.id,
		actor_id: actor.userId,
		kind: "task",
		verb,
		target: task.name,
		extra,
		project_id: task.project_id,
		task_id: task.parent_task_id ?? task.id,
	});

async function notifyAssignee(actor: Actor, task: TaskRow, memberId: string) {
	const person = await memberName(memberId);
	if (!person || person.userId === actor.userId) return;
	await notify(db, [
		{
			user_id: person.userId,
			workspace_id: actor.workspace.id,
			actor_id: actor.userId,
			type: "assign",
			text: "assigned you",
			task_id: task.id,
			project_id: task.project_id,
		},
	]);
}

const addDays = (date: Date, days: number) => {
	const d = new Date(date);
	d.setUTCDate(d.getUTCDate() + days);
	return d;
};

/**
 * Applies one edit to a task and records it, the way the reference applyPatch does:
 * completion dates, the "moved/completed/reopened" feed lines, and the next copy of a
 * repeating task when it gets done.
 */
async function applyPatch(actor: Actor, task: TaskRow, patch: Patch) {
	const set: Partial<typeof tables.task.$inferInsert> = {};
	const logs: [string, string?][] = [];
	if (patch.title !== undefined && patch.title !== task.name) {
		set.name = patch.title;
		logs.push(["renamed", `to “${patch.title}”`]);
	}
	if (patch.description !== undefined)
		set.description = patch.description || null;
	if (patch.status && patch.status !== task.status) {
		set.status = patch.status as STATUS;
		const done = patch.status === STATUS.COMPLETED;
		set.completed_at = done ? new Date() : null;
		if (task.parent_task_id)
			logs.push([
				done ? "completed subtask on" : "reopened subtask on",
				`“${task.name}”`,
			]);
		else if (done) logs.push(["completed"]);
		else if (task.status === STATUS.COMPLETED) logs.push(["reopened"]);
		else
			logs.push([
				"moved",
				`from ${taskStatus(task.status).name} to ${taskStatus(patch.status).name}`,
			]);
	}
	if (patch.priority && patch.priority !== task.priority) {
		set.priority = patch.priority as PRIORITY;
		logs.push(["changed priority of", `to ${priorityOf(patch.priority).name}`]);
	}
	if (patch.dueDate !== undefined && patch.dueDate !== toDay(task.due_date)) {
		set.due_date = patch.dueDate ? fromDay(patch.dueDate) : null;
		logs.push([
			"changed due date of",
			patch.dueDate ? `to ${fmtDay(patch.dueDate)}` : "(cleared)",
		]);
	}
	if (
		patch.startDate !== undefined &&
		patch.startDate !== toDay(task.start_date)
	) {
		set.start_date = patch.startDate ? fromDay(patch.startDate) : null;
		logs.push([
			"changed start date of",
			patch.startDate ? `to ${fmtDay(patch.startDate)}` : "(cleared)",
		]);
	}
	if (patch.labels && patch.labels.join() !== task.labels.join()) {
		set.labels = [...new Set(patch.labels)];
		logs.push(["updated labels on"]);
	}
	if (
		patch.estimate !== undefined &&
		(patch.estimate ?? null) !== task.estimate
	) {
		set.estimate = patch.estimate || null;
		logs.push(["estimated", patch.estimate || "none"]);
	}
	if (patch.recur !== undefined && (patch.recur ?? null) !== task.recur) {
		set.recur = patch.recur || null;
		logs.push([
			"set repeat on",
			patch.recur ? patch.recur.toLowerCase() : "off",
		]);
	}
	if (patch.sortOrder !== undefined) set.sort_order = patch.sortOrder;

	let updated = task;
	if (Object.keys(set).length) {
		const [row] = await db
			.update(tables.task)
			.set(set)
			.where(eq(tables.task.id, task.id))
			.returning();
		if (row) updated = row;
	}
	if (patch.assigneeId !== undefined) {
		const [current] = await db
			.select({ memberId: tables.task_assignees.member_id })
			.from(tables.task_assignees)
			.where(
				and(
					eq(tables.task_assignees.task_id, task.id),
					isNull(tables.task_assignees.deleted_at),
				),
			);
		const next = patch.assigneeId || null;
		if ((current?.memberId ?? null) !== next) {
			await checkAssignee(actor.workspace.id, next);
			await setAssignee(db, task.id, next);
			const person = next ? await memberName(next) : null;
			logs.push(
				task.parent_task_id
					? [
							"assigned a subtask on",
							person ? `to ${person.name}` : "(unassigned)",
						]
					: ["assigned", person ? `to ${person.name}` : "(unassigned)"],
			);
			if (next) await notifyAssignee(actor, updated, next);
		}
	}
	for (const [verb, extra] of logs)
		await taskActivity(actor, updated, verb, extra);

	// A repeating task comes back: the next copy is due one interval later.
	if (set.status === STATUS.COMPLETED && updated.recur && updated.due_date) {
		const due = addDays(updated.due_date, RECUR_DAYS[updated.recur] ?? 7);
		const [assignee] = await db
			.select({ memberId: tables.task_assignees.member_id })
			.from(tables.task_assignees)
			.where(
				and(
					eq(tables.task_assignees.task_id, task.id),
					isNull(tables.task_assignees.deleted_at),
				),
			);
		await insertTask(actor, {
			projectId: updated.project_id,
			title: updated.name,
			description: updated.description,
			status: STATUS.TODO,
			priority: updated.priority,
			assigneeId: assignee?.memberId ?? null,
			dueDate: toDay(due),
			startDate: toDay(due),
			labels: updated.labels,
			estimate: updated.estimate,
			recur: updated.recur,
		});
	}
	return updated;
}

type NewTask = z.infer<typeof taskInput> & { sortOrder?: number };

/** Inserts a task with the next key number, its assignee, and the "created" line. */
async function insertTask(actor: Actor, input: NewTask) {
	const task = await db.transaction(async (tx) => {
		const number = await nextNumber(tx, input.projectId);
		const [last] = await tx
			.select({ top: max(tables.task.sort_order) })
			.from(tables.task)
			.where(
				and(
					eq(tables.task.project_id, input.projectId),
					input.parentId
						? eq(tables.task.parent_task_id, input.parentId)
						: isNull(tables.task.parent_task_id),
				),
			);
		const status = (input.status ?? STATUS.TODO) as STATUS;
		const [task] = await tx
			.insert(tables.task)
			.values({
				project_id: input.projectId,
				parent_task_id: input.parentId || null,
				name: input.title,
				description: input.description || null,
				status,
				priority: (input.priority ?? PRIORITY.NONE) as PRIORITY,
				due_date: input.dueDate ? fromDay(input.dueDate) : null,
				start_date: input.startDate ? fromDay(input.startDate) : null,
				labels: input.labels ?? [],
				estimate: input.estimate || null,
				recur: input.recur || null,
				number,
				sort_order: input.sortOrder ?? (last?.top ?? 0) + 1,
				completed_at: status === STATUS.COMPLETED ? new Date() : null,
			})
			.returning();
		if (!task) throw new Error("Task insert returned nothing");
		if (input.assigneeId) await setAssignee(tx, task.id, input.assigneeId);
		if (input.parentId) {
			const [parent] = await tx
				.select()
				.from(tables.task)
				.where(eq(tables.task.id, input.parentId));
			if (parent)
				await taskActivity(
					actor,
					parent,
					"added subtask to",
					`“${task.name}”`,
					tx,
				);
		} else await taskActivity(actor, task, "created", undefined, tx);
		return task;
	});
	if (input.assigneeId) await notifyAssignee(actor, task, input.assigneeId);
	return task;
}

/** Moves a task (and its subtasks) to another project, with fresh key numbers there. */
async function moveToProject(
	actor: Actor,
	task: TaskRow,
	projectId: string,
	title: string,
) {
	const children = await db
		.select({ id: tables.task.id })
		.from(tables.task)
		.where(eq(tables.task.parent_task_id, task.id));
	for (const id of [task.id, ...children.map((c) => c.id)])
		await db
			.update(tables.task)
			.set({ project_id: projectId, number: await nextNumber(db, projectId) })
			.where(eq(tables.task.id, id));
	await db
		.delete(tables.task_dependency)
		.where(eq(tables.task_dependency.task_id, task.id));
	await db
		.delete(tables.task_dependency)
		.where(eq(tables.task_dependency.depends_on_id, task.id));
	await taskActivity(
		actor,
		{ ...task, project_id: projectId },
		"moved",
		`to ${title}`,
	);
}

export const tasksResolvers = {
	Task: {
		key: (t: Enriched) => taskKey(t.projectKey, t.number),
		projectId: (t: TaskRow) => t.project_id,
		parentId: (t: TaskRow) => t.parent_task_id,
		startDate: (t: TaskRow) => toDay(t.start_date),
		sortOrder: (t: TaskRow) => t.sort_order,
		completedAt: (t: TaskRow) => t.completed_at?.toISOString() ?? null,
		archivedAt: (t: TaskRow) => t.archived_at?.toISOString() ?? null,
		createdAt: (t: TaskRow) => t.created_at.toISOString(),
		updatedAt: (t: TaskRow) => t.updated_at.toISOString(),
		subtasks: (t: TaskRow, _: unknown, ctx: GraphQLContext) =>
			enrichTasks(eq(tables.task.parent_task_id, t.id), requireUser(ctx).id),
	},
	Project: {
		// the project's open, unarchived top-level tasks (overview "Coming up", counts)
		tasks: (p: { id: string }, _: unknown, ctx: GraphQLContext) =>
			enrichTasks(
				and(
					eq(tables.task.project_id, p.id),
					isNull(tables.task.parent_task_id),
					isNull(tables.task.archived_at),
				),
				requireUser(ctx).id,
			),
	},
	Workspace: {
		tasks: (
			w: Workspace,
			args: {
				projectId?: string | null;
				assigneeId?: string | null;
				includeArchived?: boolean | null;
			},
			ctx: GraphQLContext,
		) =>
			enrichTasks(
				and(
					eq(tables.project.workspace_id, w.id),
					projectScope(w),
					isNull(tables.task.parent_task_id),
					args.includeArchived ? undefined : isNull(tables.task.archived_at),
					args.projectId
						? eq(tables.task.project_id, args.projectId)
						: undefined,
					args.assigneeId
						? inArray(
								tables.task.id,
								db
									.select({ id: tables.task_assignees.task_id })
									.from(tables.task_assignees)
									.where(
										and(
											eq(tables.task_assignees.member_id, args.assigneeId),
											isNull(tables.task_assignees.deleted_at),
										),
									),
							)
						: undefined,
				),
				requireUser(ctx).id,
			),
		task: async (w: Workspace, args: { id: string }, ctx: GraphQLContext) => {
			const [task] = await enrichTasks(
				and(
					eq(tables.task.id, args.id),
					eq(tables.project.workspace_id, w.id),
					projectScope(w),
				),
				requireUser(ctx).id,
			);
			return task ?? null;
		},
	},
	Mutation: {
		createTask: async (
			_: unknown,
			args: { slug: string; input: unknown },
			ctx: GraphQLContext,
		) => {
			const input = parse(taskInput, args.input);
			const { user, workspace } = await requireProject(
				ctx,
				args.slug,
				input.projectId,
				{
					right: "edit",
				},
			);
			await checkAssignee(workspace.id, input.assigneeId);
			if (input.parentId) {
				const [parent] = await db
					.select()
					.from(tables.task)
					.where(
						and(
							eq(tables.task.id, input.parentId),
							isNull(tables.task.deleted_at),
						),
					);
				if (!parent || parent.project_id !== input.projectId)
					badInput("A subtask belongs to a task in the same project");
				if (parent.parent_task_id) badInput("Subtasks can't have subtasks");
			}
			const task = await insertTask({ workspace, userId: user.id }, input);
			return enrichOne(task.id, user.id);
		},

		updateTask: async (
			_: unknown,
			args: { slug: string; id: string; patch: unknown },
			ctx: GraphQLContext,
		) => {
			const patch = parse(taskPatch, args.patch);
			const { user, workspace, task } = await requireTask(
				ctx,
				args.slug,
				args.id,
				"edit",
			);
			const actor = { workspace, userId: user.id };
			if (patch.projectId && patch.projectId !== task.project_id) {
				if (task.parent_task_id) badInput("Move the parent task instead");
				const target = await requireProject(ctx, args.slug, patch.projectId, {
					right: "edit",
				});
				await moveToProject(actor, task, patch.projectId, target.project.title);
			}
			await applyPatch(
				actor,
				{ ...task, project_id: patch.projectId ?? task.project_id },
				patch,
			);
			return enrichOne(task.id, user.id);
		},

		bulkUpdateTasks: async (
			_: unknown,
			args: { slug: string; ids: string[]; patch: unknown },
			ctx: GraphQLContext,
		) => {
			const patch = parse(
				taskPatch.pick({ status: true, priority: true, assigneeId: true }),
				args.patch,
			);
			if (args.ids.length > 500) badInput("Update up to 500 tasks at a time");
			let n = 0;
			for (const id of new Set(args.ids)) {
				const { user, workspace, task } = await requireTask(
					ctx,
					args.slug,
					id,
					"edit",
				);
				await applyPatch({ workspace, userId: user.id }, task, patch);
				n++;
			}
			return n;
		},

		deleteTasks: async (
			_: unknown,
			args: { slug: string; ids: string[] },
			ctx: GraphQLContext,
		) => {
			if (args.ids.length > 500) badInput("Delete up to 500 tasks at a time");
			let n = 0;
			for (const id of new Set(args.ids)) {
				const { task } = await requireTask(ctx, args.slug, id, "edit");
				const now = new Date();
				await db
					.update(tables.task)
					.set({ deleted_at: now })
					.where(eq(tables.task.id, task.id));
				await db
					.update(tables.task)
					.set({ deleted_at: now })
					.where(
						and(
							eq(tables.task.parent_task_id, task.id),
							isNull(tables.task.deleted_at),
						),
					);
				await db
					.delete(tables.favorite)
					.where(
						and(
							eq(tables.favorite.entity_type, "task"),
							eq(tables.favorite.entity_id, task.id),
						),
					);
				n++;
			}
			return n;
		},

		archiveTask: async (
			_: unknown,
			args: { slug: string; id: string; archived: boolean },
			ctx: GraphQLContext,
		) => {
			const { user, workspace, task } = await requireTask(
				ctx,
				args.slug,
				args.id,
				"edit",
			);
			if (args.archived !== !!task.archived_at) {
				await db
					.update(tables.task)
					.set({ archived_at: args.archived ? new Date() : null })
					.where(eq(tables.task.id, task.id));
				await taskActivity(
					{ workspace, userId: user.id },
					task,
					args.archived ? "archived" : "restored",
				);
			}
			return enrichOne(task.id, user.id);
		},

		duplicateTask: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const { user, workspace, task } = await requireTask(
				ctx,
				args.slug,
				args.id,
				"edit",
			);
			const actor = { workspace, userId: user.id };
			const [source] = await enrichTasks(eq(tables.task.id, task.id), user.id);
			const copy = await insertTask(actor, {
				projectId: task.project_id,
				parentId: task.parent_task_id,
				title: `${task.name} (copy)`,
				description: task.description,
				status: task.status,
				priority: task.priority,
				assigneeId: source?.assigneeId ?? null,
				dueDate: toDay(task.due_date),
				startDate: toDay(task.start_date),
				labels: task.labels,
				estimate: task.estimate,
				recur: task.recur,
				sortOrder: task.sort_order + 0.5,
			});
			// subtasks come along, still open
			const children = await db
				.select()
				.from(tables.task)
				.where(
					and(
						eq(tables.task.parent_task_id, task.id),
						isNull(tables.task.deleted_at),
					),
				)
				.orderBy(asc(tables.task.sort_order));
			for (const child of children)
				await insertTask(actor, {
					projectId: task.project_id,
					parentId: copy.id,
					title: child.name,
					status: STATUS.TODO,
					dueDate: toDay(child.due_date),
				});
			return enrichOne(copy.id, user.id);
		},

		setDependencies: async (
			_: unknown,
			args: { slug: string; id: string; dependsOn: string[] },
			ctx: GraphQLContext,
		) => {
			const { user, workspace, task } = await requireTask(
				ctx,
				args.slug,
				args.id,
				"edit",
			);
			const ids = [...new Set(args.dependsOn)].filter((id) => id !== task.id);
			if (ids.length) {
				const same = await db
					.select({ id: tables.task.id })
					.from(tables.task)
					.where(
						and(
							inArray(tables.task.id, ids),
							eq(tables.task.project_id, task.project_id),
							isNull(tables.task.deleted_at),
						),
					);
				if (same.length !== ids.length)
					badInput("A task can only wait on tasks in the same project");
			}
			await db
				.delete(tables.task_dependency)
				.where(eq(tables.task_dependency.task_id, task.id));
			if (ids.length)
				await db
					.insert(tables.task_dependency)
					.values(
						ids.map((depends_on_id) => ({ task_id: task.id, depends_on_id })),
					);
			await taskActivity(
				{ workspace, userId: user.id },
				task,
				"updated dependencies of",
			);
			return enrichOne(task.id, user.id);
		},

		toggleTaskFavorite: async (
			_: unknown,
			args: { slug: string; id: string },
			ctx: GraphQLContext,
		) => {
			const { user, workspace, task } = await requireTask(
				ctx,
				args.slug,
				args.id,
			);
			const where = and(
				eq(tables.favorite.user_id, user.id),
				eq(tables.favorite.entity_type, "task"),
				eq(tables.favorite.entity_id, task.id),
			);
			const [existing] = await db
				.select({ id: tables.favorite.id })
				.from(tables.favorite)
				.where(where);
			if (existing) {
				await db.delete(tables.favorite).where(where);
				return false;
			}
			await db.insert(tables.favorite).values({
				user_id: user.id,
				workspace_id: workspace.id,
				entity_type: "task",
				entity_id: task.id,
			});
			return true;
		},
	},
};
