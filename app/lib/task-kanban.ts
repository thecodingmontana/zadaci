import type { TaskDocType } from "~/plugins/rxdb.client";
import type { Status } from "~/types";

export type TaskStatusKey =
  "IDEA" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED" | "ABANDONED";

export const KANBAN_STATUS_KEYS: TaskStatusKey[] = [
  "IDEA",
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "COMPLETED",
  "ABANDONED",
];

export type TaskColumns = Record<TaskStatusKey, TaskDocType[]>;

export const STATUS_TO_API: Record<TaskStatusKey, Status> = {
  IDEA: "IDEA",
  TODO: "TODO",
  IN_PROGRESS: "IN PROGRESS",
  IN_REVIEW: "IN REVIEW",
  COMPLETED: "COMPLETED",
  ABANDONED: "ABANDONED",
};

export const API_TO_STATUS: Record<Status, TaskStatusKey> = {
  IDEA: "IDEA",
  TODO: "TODO",
  "IN PROGRESS": "IN_PROGRESS",
  "IN REVIEW": "IN_REVIEW",
  COMPLETED: "COMPLETED",
  ABANDONED: "ABANDONED",
};

export const TASK_STATUS_TO_RXDB: Record<TaskStatusKey, TaskDocType["status"]> = {
  IDEA: "idea",
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  IN_REVIEW: "in_review",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
};

export function emptyTaskColumns(): TaskColumns {
  return {
    IDEA: [],
    TODO: [],
    IN_PROGRESS: [],
    IN_REVIEW: [],
    COMPLETED: [],
    ABANDONED: [],
  };
}

export function statusToColumnKey(status: TaskDocType["status"]): TaskStatusKey {
  const map: Record<TaskDocType["status"], TaskStatusKey> = {
    idea: "IDEA",
    todo: "TODO",
    in_progress: "IN_PROGRESS",
    in_review: "IN_REVIEW",
    completed: "COMPLETED",
    abandoned: "ABANDONED",
  };
  return map[status];
}

export function groupTasksByStatus(tasks: TaskDocType[]): TaskColumns {
  const columns = emptyTaskColumns();
  for (const task of tasks) {
    const key = statusToColumnKey(task.status);
    if (columns[key]) columns[key].push(task);
  }
  return columns;
}
