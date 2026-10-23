import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import { docToMarkdown } from "#/lib/export";
import { LABELS, PRIORITIES, TASK_STATUSES, taskStatus } from "#/lib/tasks";
import { type AiContext, run } from "./gql.server";

// The assistant's read-only tools. Each one runs a GraphQL operation as the signed-in person,
// so it only ever sees what they can see, and returns a small, trimmed result.

const trim = (text: string | null | undefined, max = 280) =>
	!text ? "" : text.length > max ? `${text.slice(0, max)}…` : text;

export const addDays = (day: string, n: number) =>
	new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000)
		.toISOString()
		.slice(0, 10);

const STATUS_IDS = TASK_STATUSES.map((s) => s.id) as [string, ...string[]];
const LABEL_NAMES = LABELS.map((l) => l.name.toLowerCase());

export type TaskRow = {
	id: string;
	key: string;
	name: string;
	status: string;
	priority: string;
	dueDate: string | null;
	assigneeIds: string[];
	labels: string[];
	projectId: string;
	completedAt: string | null;
	parentId: string | null;
};

export const TASK_FIELDS =
	"id key name status priority dueDate assigneeIds labels projectId completedAt parentId";

async function workspaceTasks(ctx: AiContext) {
	return run<{
		workspace: {
			tasks: TaskRow[];
			members: { id: string; name: string; isMe: boolean }[];
			projects: { id: string; title: string }[];
		} | null;
	}>(
		ctx,
		`query($slug: String!) { workspace(slug: $slug) { tasks { ${TASK_FIELDS} } members { id name isMe } projects { id title } } }`,
	);
}

/** A task as the model sees it: names instead of ids where it helps. */
export function taskView(
	t: TaskRow,
	people: Map<string, string>,
	projects: Map<string, string>,
) {
	return {
		id: t.id,
		key: t.key,
		title: t.name,
		status: taskStatus(t.status).name,
		priority: PRIORITIES.find((p) => p.id === t.priority)?.name ?? "None",
		due: t.dueDate,
		assignees: t.assigneeIds.map((id) => people.get(id) ?? "someone"),
		tags: t.labels.map((l) => LABELS.find((x) => x.id === l)?.name ?? l),
		project: projects.get(t.projectId) ?? "",
	};
}

export const searchItems = toolDefinition({
	name: "searchItems",
	description:
		"Search the workspace by words: tasks, notes, bookmarks and task comments. Use it to find an item's id before acting on it.",
	inputSchema: z.object({
		query: z.string().min(1).max(100).describe("words to look for"),
		kinds: z
			.array(z.enum(["task", "note", "bookmark", "comment"]))
			.optional()
			.describe("limit to these kinds; leave out to search everything"),
	}),
}).server<AiContext>(async ({ query, kinds }, { context }) => {
	const res = await run<{
		search: {
			tasks: {
				id: string;
				name: string;
				status: string;
				projectTitle: string;
			}[];
			notes: { id: string; title: string; snippet: string | null }[];
			bookmarks: { id: string; title: string; url: string }[];
			comments: {
				id: string;
				snippet: string;
				taskId: string;
				taskName: string;
			}[];
		};
	}>(
		context,
		`query($slug: String!, $q: String!) { search(slug: $slug, q: $q) {
			tasks { id name status projectTitle } notes { id title snippet }
			bookmarks { id title url } comments { id snippet taskId taskName } } }`,
		{ q: query },
	);
	if ("error" in res) return { error: res.error };
	const want = (k: string) => !kinds?.length || kinds.includes(k as never);
	const s = res.data.search;
	return {
		tasks: want("task")
			? s.tasks.slice(0, 8).map((t) => ({
					id: t.id,
					title: t.name,
					status: taskStatus(t.status).name,
					project: t.projectTitle,
				}))
			: [],
		notes: want("note")
			? s.notes.slice(0, 6).map((n) => ({
					id: n.id,
					title: n.title,
					snippet: trim(n.snippet, 160),
				}))
			: [],
		bookmarks: want("bookmark") ? s.bookmarks.slice(0, 6) : [],
		comments: want("comment")
			? s.comments.slice(0, 6).map((c) => ({
					taskId: c.taskId,
					task: c.taskName,
					snippet: trim(c.snippet, 160),
				}))
			: [],
	};
});

export const listTasks = toolDefinition({
	name: "listTasks",
	description:
		"List tasks with filters. Use for questions like what's due, what's overdue, or what's assigned to me.",
	inputSchema: z.object({
		due: z
			.enum(["overdue", "today", "this_week", "no_date", "any"])
			.optional()
			.describe("this_week means today through the next 6 days"),
		status: z.enum(STATUS_IDS).optional(),
		assignee: z
			.enum(["me", "anyone"])
			.optional()
			.describe("me = tasks assigned to the user"),
		tag: z.string().max(40).optional().describe("a tag name, e.g. Design"),
		projectId: z.string().max(16).optional(),
		includeDone: z
			.boolean()
			.optional()
			.describe("completed tasks are left out unless true"),
		limit: z.number().int().min(1).max(25).optional(),
	}),
}).server<AiContext>(async (input, { context }) => {
	const res = await workspaceTasks(context);
	if ("error" in res) return { error: res.error };
	const ws = res.data.workspace;
	if (!ws) return { error: "Workspace not found" };
	const people = new Map(ws.members.map((m) => [m.id, m.name]));
	const projects = new Map(ws.projects.map((p) => [p.id, p.title]));
	const me = ws.members.find((m) => m.isMe)?.id;
	const today = context.today;
	const weekEnd = addDays(today, 6);
	const tag = input.tag?.toLowerCase();
	const tagId = tag
		? LABELS.find((l) => l.name.toLowerCase() === tag)?.id
		: undefined;
	if (tag && !tagId)
		return {
			error: `Unknown tag "${input.tag}". Tags are: ${LABEL_NAMES.join(", ")}`,
		};
	const rows = ws.tasks.filter((t) => {
		if (!input.includeDone && t.status === "completed") return false;
		if (input.status && t.status !== input.status) return false;
		if (input.assignee === "me" && !(me && t.assigneeIds.includes(me)))
			return false;
		if (tagId && !t.labels.includes(tagId)) return false;
		if (input.projectId && t.projectId !== input.projectId) return false;
		const d = t.dueDate;
		if (input.due === "overdue") return !!d && d < today;
		if (input.due === "today") return d === today;
		if (input.due === "this_week") return !!d && d >= today && d <= weekEnd;
		if (input.due === "no_date") return !d;
		return true;
	});
	const limit = input.limit ?? 15;
	return {
		total: rows.length,
		tasks: rows.slice(0, limit).map((t) => taskView(t, people, projects)),
		...(rows.length > limit && { note: `Showing ${limit} of ${rows.length}` }),
	};
});

export const listProjects = toolDefinition({
	name: "listProjects",
	description:
		"List the projects the user can see, with their ids. Needed before creating or moving a task.",
	inputSchema: z.object({}),
}).server<AiContext>(async (_input, { context }) => {
	const res = await run<{
		workspace: {
			projects: { id: string; title: string; key: string; status: string }[];
		} | null;
	}>(
		context,
		`query($slug: String!) { workspace(slug: $slug) { projects { id title key status } } }`,
	);
	if ("error" in res) return { error: res.error };
	return { projects: res.data.workspace?.projects ?? [] };
});

export const getItem = toolDefinition({
	name: "getItem",
	description:
		"Read one task, note or bookmark by id, with its details (a task's description, subtasks and recent comments; a note's text).",
	inputSchema: z.object({
		kind: z.enum(["task", "note", "bookmark"]),
		id: z.string().min(1).max(16),
	}),
}).server<AiContext>(async ({ kind, id }, { context }) => {
	if (kind === "task") {
		const res = await run<{
			workspace: {
				task:
					| (TaskRow & {
							description: string | null;
							subtasks: { name: string; status: string }[];
							comments: { text: string; author: { name: string } | null }[];
					  })
					| null;
				members: { id: string; name: string }[];
				projects: { id: string; title: string }[];
			} | null;
		}>(
			context,
			`query($slug: String!, $id: ID!) { workspace(slug: $slug) {
				task(id: $id) { ${TASK_FIELDS} description subtasks { name status } comments { text author { name } } }
				members { id name } projects { id title } } }`,
			{ id },
		);
		if ("error" in res) return { error: res.error };
		const ws = res.data.workspace;
		const t = ws?.task;
		if (!ws || !t)
			return { error: "No task with that id, or you can't see it" };
		return {
			...taskView(
				t,
				new Map(ws.members.map((m) => [m.id, m.name])),
				new Map(ws.projects.map((p) => [p.id, p.title])),
			),
			description: trim(t.description?.replace(/<[^>]+>/g, " "), 800),
			subtasks: t.subtasks
				.slice(0, 15)
				.map((s) => ({ title: s.name, status: taskStatus(s.status).name })),
			recentComments: t.comments.slice(-5).map((c) => ({
				by: c.author?.name ?? "someone",
				text: trim(c.text, 200),
			})),
		};
	}
	if (kind === "note") {
		const res = await run<{
			note: { id: string; title: string; doc: unknown } | null;
		}>(
			context,
			`query($slug: String!, $id: ID!) { note(slug: $slug, id: $id) { id title doc } }`,
			{ id },
		);
		if ("error" in res) return { error: res.error };
		const n = res.data.note;
		if (!n) return { error: "No note with that id, or you can't see it" };
		return {
			id: n.id,
			title: n.title,
			text: trim(docToMarkdown(n.title, n.doc), 1500),
		};
	}
	const res = await run<{
		bookmarks: {
			id: string;
			title: string;
			url: string;
			description: string | null;
			tags: string[];
		}[];
	}>(
		context,
		`query($slug: String!) { bookmarks(slug: $slug) { id title url description tags } }`,
	);
	if ("error" in res) return { error: res.error };
	const b = res.data.bookmarks.find((x) => x.id === id);
	if (!b) return { error: "No bookmark with that id, or you can't see it" };
	return { ...b, description: trim(b.description, 400) };
});

export const READ_TOOLS = [searchItems, listTasks, listProjects, getItem];
