import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import { LABELS } from "#/lib/tasks";
import {
	bulkUpdateTasksTool,
	DAY,
	deleteTasksTool,
	ID,
	PRIORITY,
	TAG_LIST,
	TASK_CHANGES,
} from "./approval-tools";
import { type AiContext, run } from "./gql.server";

// The assistant's tools that change things. Each runs a GraphQL mutation as the signed-in
// person (so permissions apply) and is logged in the activity feed as "via assistant".
// Deleting, and changing more than 3 tasks at once, wait for the person to approve.

/** Tag names to label ids; unknown names come back as an error the model can fix. */
function tagIds(names: string[] | undefined) {
	const ids: string[] = [];
	for (const name of names ?? []) {
		const hit = LABELS.find(
			(l) => l.name.toLowerCase() === name.trim().toLowerCase(),
		);
		if (!hit) return { error: `Unknown tag "${name}". Tags are: ${TAG_LIST}` };
		ids.push(hit.id);
	}
	return { ids };
}

async function myMemberId(ctx: AiContext) {
	const res = await run<{
		workspace: { members: { id: string; isMe: boolean }[] } | null;
	}>(
		ctx,
		`query($slug: String!) { workspace(slug: $slug) { members { id isMe } } }`,
	);
	return "error" in res
		? null
		: (res.data.workspace?.members.find((m) => m.isMe)?.id ?? null);
}

async function currentTask(ctx: AiContext, id: string) {
	const res = await run<{
		workspace: {
			task: {
				id: string;
				key: string;
				name: string;
				labels: string[];
				assigneeIds: string[];
			} | null;
		} | null;
	}>(
		ctx,
		`query($slug: String!, $id: ID!) { workspace(slug: $slug) { task(id: $id) { id key name labels assigneeIds } } }`,
		{ id },
	);
	return "error" in res ? null : (res.data.workspace?.task ?? null);
}

const UPDATE = `mutation($slug: String!, $id: ID!, $patch: TaskPatch!) { updateTask(slug: $slug, id: $id, patch: $patch) { id key name } }`;

// without approval, one message may change at most this many tasks (split calls included)
export const FREE_EDITS = 3;

/** Applies one patch (plus tag changes) to each task; returns what changed and what failed. */
async function patchTasks(
	ctx: AiContext,
	taskIds: string[],
	patch: Record<string, unknown>,
	addTags: string[] = [],
	removeTags: string[] = [],
	approved = false,
) {
	if (!approved) {
		const after = new Set([...ctx.edited, ...taskIds]);
		if (after.size > FREE_EDITS)
			return {
				error: `Changing more than ${FREE_EDITS} tasks in one request needs the user's approval: call bulkUpdateTasks with all the task ids instead.`,
			};
		for (const id of taskIds) ctx.edited.add(id);
	}
	const changed: { id: string; key: string; title: string }[] = [];
	const failed: string[] = [];
	for (const id of taskIds) {
		const task = await currentTask(ctx, id);
		if (!task) {
			failed.push(`${id}: no such task, or you can't see it`);
			continue;
		}
		const labels =
			addTags.length || removeTags.length
				? [
						...new Set([
							...task.labels.filter((l) => !removeTags.includes(l)),
							...addTags,
						]),
					]
				: undefined;
		const res = await run(ctx, UPDATE, {
			id,
			patch: { ...patch, ...(labels && { labels }) },
		});
		if ("error" in res) failed.push(`${task.key}: ${res.error}`);
		else changed.push({ id: task.id, key: task.key, title: task.name });
	}
	return { changed, ...(failed.length && { failed }) };
}

export const createTask = toolDefinition({
	name: "createTask",
	description:
		"Create a task in a project. Get the project id from listProjects first.",
	inputSchema: z.object({
		title: z.string().min(1).max(200),
		projectId: ID,
		dueDate: DAY.optional(),
		priority: PRIORITY.optional(),
		tags: z
			.array(z.string())
			.max(5)
			.optional()
			.describe(`tag names: ${TAG_LIST}`),
		description: z.string().max(2000).optional(),
		assignToMe: z
			.boolean()
			.optional()
			.describe("assign it to the user (default true)"),
	}),
}).server<AiContext>(async (input, { context }) => {
	const tags = tagIds(input.tags);
	if ("error" in tags) return { error: tags.error };
	const me = input.assignToMe === false ? null : await myMemberId(context);
	const res = await run<{
		createTask: { id: string; key: string; name: string };
	}>(
		context,
		`mutation($slug: String!, $input: TaskInput!) { createTask(slug: $slug, input: $input) { id key name } }`,
		{
			input: {
				projectId: input.projectId,
				title: input.title,
				...(input.dueDate && { dueDate: input.dueDate }),
				...(input.priority && { priority: input.priority }),
				...(tags.ids.length && { labels: tags.ids }),
				...(input.description && { description: input.description }),
				...(me && { assigneeIds: [me] }),
			},
		},
	);
	if ("error" in res) return { error: res.error };
	return { created: res.data.createTask };
});

export const updateTask = toolDefinition({
	name: "updateTask",
	description:
		"Change up to 3 tasks: status, priority, due date, title, tags. For more than 3 tasks use bulkUpdateTasks.",
	inputSchema: z.object({
		taskIds: z.array(ID).min(1).max(3),
		title: z
			.string()
			.min(1)
			.max(200)
			.optional()
			.describe("only with a single task"),
		removeTags: z.array(z.string()).max(5).optional(),
		...TASK_CHANGES,
	}),
}).server<AiContext>(async (input, { context }) => {
	if (input.title && input.taskIds.length > 1)
		return { error: "Rename one task at a time" };
	const add = tagIds(input.addTags);
	if ("error" in add) return { error: add.error };
	const remove = tagIds(input.removeTags);
	if ("error" in remove) return { error: remove.error };
	return patchTasks(
		context,
		input.taskIds,
		{
			...(input.title && { title: input.title }),
			...(input.status && { status: input.status }),
			...(input.priority && { priority: input.priority }),
			...(input.dueDate !== undefined && { dueDate: input.dueDate }),
		},
		add.ids,
		remove.ids,
	);
});

export const addTag = toolDefinition({
	name: "addTag",
	description: "Add a tag to up to 3 tasks.",
	inputSchema: z.object({
		taskIds: z.array(ID).min(1).max(3),
		tag: z.string().min(1).max(40).describe(`one of: ${TAG_LIST}`),
	}),
}).server<AiContext>(async ({ taskIds, tag }, { context }) => {
	const ids = tagIds([tag]);
	if ("error" in ids) return { error: ids.error };
	return patchTasks(context, taskIds, {}, ids.ids);
});

export const bulkUpdateTasks = bulkUpdateTasksTool.server<AiContext>(
	async (input, { context }) => {
		const add = tagIds(input.addTags);
		if ("error" in add) return { error: add.error };
		return patchTasks(
			context,
			input.taskIds,
			{
				...(input.status && { status: input.status }),
				...(input.priority && { priority: input.priority }),
				...(input.dueDate !== undefined && { dueDate: input.dueDate }),
			},
			add.ids,
			[],
			true,
		);
	},
);

export const moveTask = toolDefinition({
	name: "moveTask",
	description:
		"Move one task to another project. Get project ids from listProjects.",
	inputSchema: z.object({ taskId: ID, projectId: ID }),
}).server<AiContext>(async ({ taskId, projectId }, { context }) =>
	patchTasks(context, [taskId], { projectId }),
);

export const addComment = toolDefinition({
	name: "addComment",
	description: "Add a comment to a task, written as the user.",
	inputSchema: z.object({ taskId: ID, text: z.string().min(1).max(2000) }),
}).server<AiContext>(async ({ taskId, text }, { context }) => {
	const res = await run(
		context,
		`mutation($slug: String!, $t: ID!, $x: String!) { addComment(slug: $slug, taskId: $t, text: $x) { id } }`,
		{ t: taskId, x: text },
	);
	return "error" in res ? { error: res.error } : { commented: true };
});

/** Plain text as a page: one paragraph per line, "- " lines as a bulleted list. */
function textToDoc(text: string) {
	const content: object[] = [];
	let list: object[] | null = null;
	for (const raw of text.split("\n")) {
		const line = raw.trimEnd();
		const para = (t: string) => ({
			type: "paragraph",
			...(t && { content: [{ type: "text", text: t }] }),
		});
		if (/^[-*] /.test(line)) {
			if (!list) {
				list = [];
				content.push({ type: "bulletList", content: list });
			}
			list.push({ type: "listItem", content: [para(line.slice(2))] });
		} else {
			list = null;
			if (line) content.push(para(line));
		}
	}
	return {
		type: "doc",
		content: content.length ? content : [{ type: "paragraph" }],
	};
}

export const createNote = toolDefinition({
	name: "createNote",
	description:
		'Create a note page with a title and plain-text content (use "- " for bullet points).',
	inputSchema: z.object({
		title: z.string().min(1).max(200),
		text: z.string().max(8000).optional(),
	}),
}).server<AiContext>(async ({ title, text }, { context }) => {
	const res = await run<{ createNote: { id: string; title: string } }>(
		context,
		`mutation($slug: String!, $input: NewNote!) { createNote(slug: $slug, input: $input) { id title } }`,
		{ input: { title } },
	);
	if ("error" in res) return { error: res.error };
	const note = res.data.createNote;
	if (text) {
		const saved = await run(
			context,
			`mutation($slug: String!, $id: ID!, $patch: NotePatch!) { updateNote(slug: $slug, id: $id, patch: $patch) { id } }`,
			{ id: note.id, patch: { doc: textToDoc(text) } },
		);
		if ("error" in saved)
			return {
				created: note,
				warning: `The page was made but its text wasn't saved: ${saved.error}`,
			};
	}
	return { created: note };
});

export const deleteTasks = deleteTasksTool.server<AiContext>(
	async ({ taskIds }, { context }) => {
		const res = await run<{ deleteTasks: number }>(
			context,
			`mutation($slug: String!, $ids: [ID!]!) { deleteTasks(slug: $slug, ids: $ids) }`,
			{ ids: taskIds },
		);
		return "error" in res
			? { error: res.error }
			: { deleted: res.data.deleteTasks, canRestore: true };
	},
);

export const WRITE_TOOLS = [
	createTask,
	updateTask,
	addTag,
	bulkUpdateTasks,
	moveTask,
	addComment,
	createNote,
	deleteTasks,
];
