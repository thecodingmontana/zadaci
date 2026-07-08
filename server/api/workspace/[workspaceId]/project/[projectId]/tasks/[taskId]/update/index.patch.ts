import type { Priority, ProjectMembers, Status } from "~~/shared/types";
import { and, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { PRIORITY, STATUS } from "~~/server/database/enums";
import { sendTaskCompletionMail } from "~~/server/libs/emails/actions/completed-task";
import { sendTaskAssignmentEmail } from "~~/server/libs/emails/actions/send-task-assignment";
import { validPriorities, validStatuses } from "~~/shared/types";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const workspaceId = getRouterParam(event, "workspaceId");
    const projectId = getRouterParam(event, "projectId");
    const taskId = getRouterParam(event, "taskId");
    const { name, status, dueDate, description, priority, subtasks, assignees } = (await readBody(
      event,
    )) as {
      description?: string;
      dueDate?: string | Date;
      name: string;
      status: Status;
      priority: Priority;
      subtasks?: { name: string; is_completed: boolean }[];
      assignees: ProjectMembers[];
    };
    if (!session) throw createError({ statusCode: 401, statusMessage: "Unauthorized!" });
    if (typeof workspaceId !== "string" || !workspaceId)
      throw createError({ statusCode: 400, statusMessage: "Invalid workspace ID!" });
    if (!projectId || typeof projectId !== "string")
      throw createError({ statusCode: 400, statusMessage: "ProjectID is required!" });
    if (!taskId || typeof taskId !== "string")
      throw createError({ statusCode: 400, statusMessage: "TaskID is required!" });
    if (typeof name !== "string" || !name)
      throw createError({ statusCode: 400, statusMessage: "Invalid name!" });
    if (typeof status !== "string" || !validStatuses.includes(status))
      throw createError({ statusCode: 400, statusMessage: "Invalid Status!" });
    if (typeof priority !== "string" || !validPriorities.includes(priority))
      throw createError({ statusCode: 400, statusMessage: "Invalid Priority!" });
    if (description !== undefined && typeof description !== "string")
      throw createError({ statusCode: 400, statusMessage: "Invalid description!" });
    if (dueDate !== undefined && typeof dueDate !== "string" && !(dueDate instanceof Date))
      throw createError({ statusCode: 400, statusMessage: "Invalid due date!" });
    if (!assignees || !Array.isArray(assignees) || assignees.length === 0)
      throw createError({
        statusCode: 400,
        statusMessage: "At least one assigned member is required!",
      });
    if (
      subtasks !== undefined &&
      (!Array.isArray(subtasks) ||
        !subtasks.every(
          (item) =>
            typeof item === "object" &&
            item !== null &&
            "name" in item &&
            "is_completed" in item &&
            typeof item.name === "string" &&
            typeof item.is_completed === "boolean",
        ))
    ) {
      throw createError({ statusCode: 400, statusMessage: "Invalid subtasks!" });
    }
    for (const member of assignees) {
      if (!member || typeof member !== "object")
        throw createError({ statusCode: 400, statusMessage: "Invalid assigned member format!" });
      if (typeof member.member_id !== "string" || !member.member_id)
        throw createError({
          statusCode: 400,
          statusMessage: "Each assigned member must have a valid ID!",
        });
    }
    const parsedDueDate = dueDate ? new Date(dueDate) : undefined;
    if (parsedDueDate && Number.isNaN(parsedDueDate.getTime()))
      throw createError({ statusCode: 400, statusMessage: "Invalid due date!" });

    const statusValue = STATUS[status as keyof typeof STATUS];
    const priorityValue = PRIORITY[priority as keyof typeof PRIORITY];

    const memberIds = assignees.map((m) => m.member_id);
    const validWorkspaceMembers = await db.query.workspace_members.findMany({
      where: {
        id: { in: memberIds },
        workspace_id: workspaceId,
      },
      columns: { id: true },
    });
    const validWorkspaceIds = validWorkspaceMembers.map((m) => m.id);
    const invalidWorkspaceMembers = memberIds.filter((id) => !validWorkspaceIds.includes(id));
    if (invalidWorkspaceMembers.length) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid assignees (not in workspace): ${invalidWorkspaceMembers.join(", ")}`,
      });
    }
    const workspace = await db.query.workspace.findFirst({
      where: { id: workspaceId },
    });
    if (!workspace) throw createError({ statusCode: 400, statusMessage: "Invalid Workspace!" });
    const project = await db.query.project.findFirst({
      where: {
        id: projectId,
        workspace_id: workspaceId,
      },
      with: {
        workspace: true,
      },
    });
    if (!project) throw createError({ statusCode: 400, statusMessage: "Invalid Project!" });
    if (!project.workspace)
      throw createError({ statusCode: 400, statusMessage: "Project workspace not found!" });
    const validProjectMembers = await db.query.project_members.findMany({
      where: {
        member_id: { in: memberIds },
        project_id: project.id,
      },
      columns: { member_id: true },
    });
    const validProjectIds = validProjectMembers.map((m) => m.member_id);
    const invalidProjectMembers = memberIds.filter((id) => !validProjectIds.includes(id));
    if (invalidProjectMembers.length) {
      const invalidUsers = await db.query.workspace_members.findMany({
        where: { id: { in: invalidProjectMembers } },
        with: { user: true },
        columns: { id: true },
      });
      const invalidNames = invalidUsers
        .filter((m) => m.user)
        .map((m) => m.user!.username)
        .join(", ");
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid assigned members (not in project): ${invalidNames}`,
      });
    }
    const existingTask = await db.query.task.findFirst({
      where: {
        id: taskId,
        project_id: projectId,
      },
    });
    if (!existingTask) throw createError({ statusCode: 404, statusMessage: "Task not found!" });
    const [task] = await db
      .update(tables.task)
      .set({
        name,
        description,
        updated_at: new Date(),
        priority: priorityValue,
        status: statusValue,
        due_date: parsedDueDate || null,
      })
      .where(and(eq(tables.task.id, taskId), eq(tables.task.project_id, projectId)))
      .returning();

    if (!task) {
      throw createError({ statusCode: 500, statusMessage: "Failed to update task!" });
    }

    if (["COMPLETED", "IN REVIEW", "ABANDONED"].includes(status)) {
      const member = await db.query.workspace_members.findFirst({
        where: {
          workspace_id: workspaceId,
          user_id: session.user.id,
        },
        columns: { id: true },
      });
      if (!member) {
        throw createError({
          statusCode: 403,
          statusMessage: "You are not a member of this workspace!",
        });
      }
      await db.insert(tables.tasks_activity).values({
        task_id: taskId,
        changed_by: member.id,
        status: statusValue,
        changed_at: new Date(),
      });
    }
    if (subtasks && subtasks.length > 0) {
      await db.delete(tables.subtasks).where(eq(tables.subtasks.task_id, task.id));
      const subtaskValues = subtasks.map((subtask) => ({
        created_at: new Date(),
        updated_at: new Date(),
        name: subtask.name,
        task_id: task.id,
        is_completed: subtask.is_completed,
      }));
      await db.insert(tables.subtasks).values(subtaskValues);
    } else {
      await db.delete(tables.subtasks).where(eq(tables.subtasks.task_id, task.id));
    }
    if (assignees && assignees.length > 0) {
      const existingMembers = await db.query.project_members.findMany({
        where: { project_id: projectId },
        columns: {
          member_id: true,
        },
      });
      const existingMemberIds = existingMembers.map((m) => m.member_id);
      await db.delete(tables.task_assignees).where(eq(tables.task_assignees.task_id, task.id));
      const assigneeValues = assignees.map((member) => ({
        task_id: task.id,
        member_id: member.member_id,
        assigned_at: new Date(),
      }));
      await db.insert(tables.task_assignees).values(assigneeValues);
      const newMemberIds = memberIds.filter(
        (id) => !existingMemberIds.includes(id) && id !== session.user.id,
      );
      if (newMemberIds.length > 0) {
        const usersToNotify = await db.query.workspace_members.findMany({
          where: { id: { in: newMemberIds } },
          with: {
            user: true,
          },
        });
        for (const member of usersToNotify) {
          if (!member.user?.email || member.user_id === session.user.id) continue;
          await sendTaskAssignmentEmail({
            email: member.user.email,
            user: member.user.username,
            addedBy: session.user.username,
            project: project.title,
            workspace: workspace.name,
            link: `${process.env.NUXT_PUBLIC_SITE_URL}/workspace/${workspace.id}/projects/${projectId}`,
            task: task.name,
          });
        }
      }
      if (status === "COMPLETED") {
        for (const member of assignees) {
          await sendTaskCompletionMail({
            workspace: project.workspace.name,
            user: member.username as string,
            project: project.title,
            completedBy: session.user.username,
            link: `${process.env.NUXT_PUBLIC_SITE_URL}/workspace/${project.workspace.id}/projects/${project.id}`,
            email: member.email,
            task: task.name,
          });
        }
      }
    }
    return { message: "Task updated successfully" };
  } catch (error: any) {
    const errorMessage = error?.message || "Unknown error";
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: `Update Task error: ${errorMessage}!`,
    });
  }
});
