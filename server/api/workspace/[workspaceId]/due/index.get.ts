import type { DueItem } from "~~/shared/types";
import { isThisWeek, isToday, isTomorrow } from "date-fns";
import { and, eq, notInArray } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { STATUS } from "~~/server/database/enums";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);

    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized!",
      });
    }

    const workspaceId = getRouterParam(event, "workspaceId") as string;
    const userId = session.user.id;

    const rows = await db
      .select({
        projectId: tables.project.id,
        projectTitle: tables.project.title,
        projectDue: tables.project.due_date,
        projectPriority: tables.project.priority,
        projectDesc: tables.project.description,
        taskId: tables.task.id,
        taskTitle: tables.task.name,
        taskDue: tables.task.due_date,
        taskPriority: tables.task.priority,
        taskDesc: tables.task.description,
        memberId: tables.workspace_members.id,
        userId: tables.user.id,
        username: tables.user.username,
        avatar: tables.user.profile_picture_url,
        workspaceId: tables.workspace.id,
      })
      .from(tables.workspace_members)
      .innerJoin(tables.workspace, eq(tables.workspace_members.workspace_id, tables.workspace.id))
      .innerJoin(tables.user, eq(tables.workspace_members.user_id, tables.user.id))
      .innerJoin(
        tables.project_members,
        eq(tables.workspace_members.id, tables.project_members.member_id),
      )
      .innerJoin(
        tables.project,
        and(
          eq(tables.project_members.project_id, tables.project.id),
          notInArray(tables.project.status, [STATUS.IN_REVIEW, STATUS.COMPLETED, STATUS.ABANDONED]),
        ),
      )
      .leftJoin(
        tables.task,
        and(
          eq(tables.task.project_id, tables.project.id),
          notInArray(tables.task.status, [STATUS.IN_REVIEW, STATUS.COMPLETED, STATUS.ABANDONED]),
        ),
      )
      .where(
        and(eq(tables.workspace.id, workspaceId), eq(tables.workspace_members.user_id, userId)),
      );

    const items: DueItem[] = rows.flatMap((row) => {
      const res: DueItem[] = [];

      if (row.projectId && row.projectDue) {
        if (isToday(row.projectDue) || isTomorrow(row.projectDue) || isThisWeek(row.projectDue)) {
          res.push({
            id: row.projectId,
            projectId: row.projectId,
            type: "project",
            title: row.projectTitle,
            dueDate: row.projectDue,
            assignee: row.username,
            avatar: row.avatar,
            priority: row.projectPriority,
            description: row.projectDesc,
            workspaceId: row.workspaceId,
          });
        }
      }

      if (row.taskId && row.taskDue) {
        if (isToday(row.taskDue) || isTomorrow(row.taskDue) || isThisWeek(row.taskDue)) {
          res.push({
            id: row.taskId,
            projectId: row.projectId,
            type: "task",
            title: row.taskTitle as string,
            dueDate: row.taskDue,
            assignee: row.username,
            avatar: row.avatar,
            priority: row.taskPriority,
            description: row.taskDesc,
            workspaceId: row.workspaceId,
          });
        }
      }

      return res;
    });

    return items;
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      statusMessage: `Failed to fetch due items: ${errorMessage}!`,
    });
  }
});
