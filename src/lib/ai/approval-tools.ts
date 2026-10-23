import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import { LABELS, PRIORITIES, TASK_STATUSES } from "#/lib/tasks";

// The assistant's tools that wait for the person's approval. Only the definitions live here
// (no code that runs them), so the chat screen can share them to show typed approval cards;
// the server attaches what they do in write-tools.server.ts.

export const TAG_LIST = LABELS.map((l) => l.name).join(", ");
export const DAY = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
	.describe("a date as YYYY-MM-DD");
export const STATUS = z.enum(
	TASK_STATUSES.map((s) => s.id) as [string, ...string[]],
);
export const PRIORITY = z.enum(
	PRIORITIES.map((p) => p.id) as [string, ...string[]],
);
export const ID = z.string().min(1).max(16);

/** The changes any task update can make. */
export const TASK_CHANGES = {
	status: STATUS.optional(),
	priority: PRIORITY.optional(),
	dueDate: DAY.nullable().optional().describe("null clears the date"),
	addTags: z
		.array(z.string())
		.max(5)
		.optional()
		.describe(`tag names: ${TAG_LIST}`),
};

export const bulkUpdateTasksTool = toolDefinition({
	name: "bulkUpdateTasks",
	description:
		"Change more than 3 tasks at once (status, priority, due date, add tags). The user approves it first.",
	inputSchema: z.object({
		taskIds: z.array(ID).min(1).max(50),
		...TASK_CHANGES,
	}),
	needsApproval: true,
});

export const deleteTasksTool = toolDefinition({
	name: "deleteTasks",
	description:
		"Delete tasks. The user approves it first. Deleted tasks can be restored from the app.",
	inputSchema: z.object({ taskIds: z.array(ID).min(1).max(50) }),
	needsApproval: true,
});

export const APPROVAL_TOOLS = [bulkUpdateTasksTool, deleteTasksTool] as const;
