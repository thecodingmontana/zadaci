import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import { PROJECT_STATUS } from "#/db/enums";
import { PROJECT_ICONS } from "#/lib/projects";
import { archiveProjectTool, DAY, ID } from "./approval-tools";
import { type AiContext, run } from "./gql.server";
import { patchTasks, textToDoc } from "./write-tools.server";

// The rest of what a person can do in the app, as assistant tools: people, projects, notes,
// bookmarks, timers. Each one is a GraphQL call made as the signed-in person, so the app's own
// permission checks decide what works; the assistant can't do anything they couldn't.

const PROJECT_STATUSES = Object.values(PROJECT_STATUS) as [string, ...string[]];

export const listMembers = toolDefinition({
	name: "listMembers",
	description:
		"List the people in this workspace with their ids, to assign tasks or make someone a project lead.",
	inputSchema: z.object({}),
}).server<AiContext>(async (_input, { context }) => {
	const res = await run<{
		workspace: {
			members: { id: string; name: string; role: string; isMe: boolean }[];
		} | null;
	}>(
		context,
		`query($slug: String!) { workspace(slug: $slug) { members { id name role isMe } } }`,
	);
	if ("error" in res) return { error: res.error };
	return { members: res.data.workspace?.members ?? [] };
});

export const assignTasks = toolDefinition({
	name: "assignTasks",
	description:
		"Set who is assigned to up to 3 tasks (replaces the current people). Get member ids from listMembers; an empty list unassigns.",
	inputSchema: z.object({
		taskIds: z.array(ID).min(1).max(3),
		memberIds: z.array(ID).max(20),
	}),
}).server<AiContext>(async ({ taskIds, memberIds }, { context }) =>
	patchTasks(context, taskIds, { assigneeIds: memberIds }),
);

export const addSubtask = toolDefinition({
	name: "addSubtask",
	description: "Add a subtask under an existing task.",
	inputSchema: z.object({
		parentTaskId: ID,
		title: z.string().min(1).max(200),
		dueDate: DAY.optional(),
	}),
}).server<AiContext>(async ({ parentTaskId, title, dueDate }, { context }) => {
	const parent = await run<{
		workspace: { task: { projectId: string } | null } | null;
	}>(
		context,
		`query($slug: String!, $id: ID!) { workspace(slug: $slug) { task(id: $id) { projectId } } }`,
		{ id: parentTaskId },
	);
	if ("error" in parent) return { error: parent.error };
	const projectId = parent.data.workspace?.task?.projectId;
	if (!projectId) return { error: "No task with that id, or you can't see it" };
	const res = await run<{
		createTask: { id: string; key: string; name: string };
	}>(
		context,
		`mutation($slug: String!, $input: TaskInput!) { createTask(slug: $slug, input: $input) { id key name } }`,
		{
			input: {
				projectId,
				parentId: parentTaskId,
				title,
				...(dueDate && { dueDate }),
			},
		},
	);
	return "error" in res
		? { error: res.error }
		: { created: res.data.createTask };
});

export const restoreTasks = toolDefinition({
	name: "restoreTasks",
	description: "Bring back tasks that were deleted (undo a delete).",
	inputSchema: z.object({ taskIds: z.array(ID).min(1).max(50) }),
}).server<AiContext>(async ({ taskIds }, { context }) => {
	const res = await run<{ restoreTasks: number }>(
		context,
		`mutation($slug: String!, $ids: [ID!]!) { restoreTasks(slug: $slug, ids: $ids) }`,
		{ ids: taskIds },
	);
	return "error" in res
		? { error: res.error }
		: { restored: res.data.restoreTasks };
});

export const duplicateTask = toolDefinition({
	name: "duplicateTask",
	description: "Make a copy of a task in the same project.",
	inputSchema: z.object({ taskId: ID }),
}).server<AiContext>(async ({ taskId }, { context }) => {
	const res = await run<{
		duplicateTask: { id: string; key: string; name: string };
	}>(
		context,
		`mutation($slug: String!, $id: ID!) { duplicateTask(slug: $slug, id: $id) { id key name } }`,
		{ id: taskId },
	);
	return "error" in res
		? { error: res.error }
		: { created: res.data.duplicateTask };
});

export const timer = toolDefinition({
	name: "timer",
	description:
		"Start the time tracker on a task, or stop the running one (time is added to the task).",
	inputSchema: z.object({
		action: z.enum(["start", "stop"]),
		taskId: ID.optional().describe("needed to start"),
	}),
}).server<AiContext>(async ({ action, taskId }, { context }) => {
	if (action === "start" && !taskId)
		return { error: "Say which task to time" };
	const res =
		action === "start"
			? await run(
					context,
					`mutation($slug: String!, $t: ID!) { startTimer(slug: $slug, taskId: $t) }`,
					{ t: taskId },
				)
			: await run(
					context,
					`mutation($slug: String!) { stopTimer(slug: $slug) }`,
				);
	return "error" in res ? { error: res.error } : { ok: true, action };
});

type ProjectRow = { id: string; title: string };

export const createProject = toolDefinition({
	name: "createProject",
	description: "Create a new project.",
	inputSchema: z.object({
		title: z.string().min(1).max(120),
		description: z.string().max(2000).optional(),
		dueDate: DAY.optional(),
		leadId: ID.optional().describe("a member id from listMembers"),
	}),
}).server<AiContext>(async (input, { context }) => {
	const res = await run<{ createProject: ProjectRow }>(
		context,
		`mutation($slug: String!, $input: ProjectInput!) { createProject(slug: $slug, input: $input) { id title } }`,
		{
			input: {
				title: input.title,
				icon: PROJECT_ICONS[0][0],
				color: "indigo",
				...(input.description && { description: input.description }),
				...(input.dueDate && { dueDate: input.dueDate }),
				...(input.leadId && { leadId: input.leadId }),
			},
		},
	);
	return "error" in res
		? { error: res.error }
		: { projects: [res.data.createProject] };
});

export const updateProject = toolDefinition({
	name: "updateProject",
	description:
		"Change a project: title, description, status, start or due date, or lead.",
	inputSchema: z.object({
		projectId: ID,
		title: z.string().min(1).max(120).optional(),
		description: z.string().max(2000).optional(),
		status: z.enum(PROJECT_STATUSES).optional(),
		startDate: DAY.nullable().optional(),
		dueDate: DAY.nullable().optional(),
		leadId: ID.nullable().optional(),
	}),
}).server<AiContext>(async ({ projectId, ...patch }, { context }) => {
	const res = await run<{ updateProject: ProjectRow }>(
		context,
		`mutation($slug: String!, $p: ID!, $input: ProjectPatch!) { updateProject(slug: $slug, projectId: $p, input: $input) { id title } }`,
		{ p: projectId, input: patch },
	);
	return "error" in res
		? { error: res.error }
		: { projects: [res.data.updateProject] };
});

export const archiveProject = archiveProjectTool.server<AiContext>(
	async ({ projectId }, { context }) => {
		const res = await run<{ archiveProject: ProjectRow }>(
			context,
			`mutation($slug: String!, $p: ID!) { archiveProject(slug: $slug, projectId: $p, archived: true) { id title } }`,
			{ p: projectId },
		);
		return "error" in res
			? { error: res.error }
			: { archived: res.data.archiveProject.title, canRestore: true };
	},
);

export const addMilestone = toolDefinition({
	name: "addMilestone",
	description: "Add a milestone (a named date) to a project.",
	inputSchema: z.object({
		projectId: ID,
		name: z.string().min(1).max(120),
		date: DAY,
	}),
}).server<AiContext>(async ({ projectId, name, date }, { context }) => {
	const res = await run(
		context,
		`mutation($slug: String!, $p: ID!, $n: String!, $d: String!) { addMilestone(slug: $slug, projectId: $p, name: $n, date: $d) { id } }`,
		{ p: projectId, n: name, d: date },
	);
	return "error" in res ? { error: res.error } : { added: name };
});

export const editNote = toolDefinition({
	name: "editNote",
	description:
		'Rename a note page and/or add text to the end of it (plain text, "- " lines become bullets).',
	inputSchema: z.object({
		noteId: ID,
		title: z.string().min(1).max(200).optional(),
		appendText: z.string().min(1).max(8000).optional(),
	}),
}).server<AiContext>(async ({ noteId, title, appendText }, { context }) => {
	if (!title && !appendText) return { error: "Nothing to change" };
	let doc: unknown;
	if (appendText) {
		const cur = await run<{
			note: { doc: { content?: unknown[] } | null } | null;
		}>(
			context,
			`query($slug: String!, $id: ID!) { note(slug: $slug, id: $id) { doc } }`,
			{ id: noteId },
		);
		if ("error" in cur) return { error: cur.error };
		if (!cur.data.note)
			return { error: "No note with that id, or you can't see it" };
		doc = {
			type: "doc",
			content: [
				...(cur.data.note.doc?.content ?? []),
				...textToDoc(appendText).content,
			],
		};
	}
	const res = await run<{ updateNote: { id: string; title: string } }>(
		context,
		`mutation($slug: String!, $id: ID!, $patch: NotePatch!) { updateNote(slug: $slug, id: $id, patch: $patch) { id title } }`,
		{
			id: noteId,
			patch: { ...(title && { title }), ...(doc ? { doc } : {}) },
		},
	);
	return "error" in res
		? { error: res.error }
		: { notes: [res.data.updateNote] };
});

export const commentOnNote = toolDefinition({
	name: "commentOnNote",
	description: "Add a comment to a note page, written as the user.",
	inputSchema: z.object({ noteId: ID, text: z.string().min(1).max(2000) }),
}).server<AiContext>(async ({ noteId, text }, { context }) => {
	const res = await run(
		context,
		`mutation($slug: String!, $n: ID!, $x: String!) { addNoteComment(slug: $slug, noteId: $n, text: $x) { id } }`,
		{ n: noteId, x: text },
	);
	return "error" in res ? { error: res.error } : { commented: true };
});

export const saveBookmark = toolDefinition({
	name: "saveBookmark",
	description: "Save a link as a bookmark.",
	inputSchema: z.object({
		url: z.string().url().max(2000),
		title: z.string().max(200).optional(),
		tags: z.array(z.string().max(40)).max(8).optional(),
	}),
}).server<AiContext>(async ({ url, title, tags }, { context }) => {
	const res = await run<{ createBookmark: { id: string; title: string } }>(
		context,
		`mutation($slug: String!, $input: NewBookmark!) { createBookmark(slug: $slug, input: $input) { id title } }`,
		{ input: { url, ...(title && { title }), ...(tags && { tags }) } },
	);
	return "error" in res
		? { error: res.error }
		: { saved: res.data.createBookmark };
});

export const MORE_TOOLS = [
	listMembers,
	assignTasks,
	addSubtask,
	restoreTasks,
	duplicateTask,
	timer,
	createProject,
	updateProject,
	archiveProject,
	addMilestone,
	editNote,
	commentOnNote,
	saveBookmark,
];
