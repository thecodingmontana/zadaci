import type { Priority, ProjectMembers, Status } from "~~/shared/types";
import { db, tables } from "~~/server/database/db";
import { PRIORITY, STATUS } from "~~/server/database/enums";
import { sendTaskAssignmentEmail } from "~~/server/libs/emails/actions/send-task-assignment";
import { appLink, validPriorities, validStatuses } from "~~/shared/types";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const workspaceId = getRouterParam(event, "workspaceId");
    const projectId = getRouterParam(event, "projectId");
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
    if (typeof projectId !== "string" || !projectId)
      throw createError({ statusCode: 400, statusMessage: "Project ID is required!" });
    if (typeof name !== "string" || !name)
      throw createError({ statusCode: 400, statusMessage: "Invalid task title!" });
    if (typeof status !== "string" || !validStatuses.includes(status))
      throw createError({ statusCode: 400, statusMessage: "Invalid status!" });
    if (typeof priority !== "string" || !validPriorities.includes(priority))
      throw createError({ statusCode: 400, statusMessage: "Invalid priority!" });
    if (description !== undefined && typeof description !== "string")
      throw createError({ statusCode: 400, statusMessage: "Invalid description!" });
    if (dueDate !== undefined && typeof dueDate !== "string" && !(dueDate instanceof Date))
      throw createError({ statusCode: 400, statusMessage: "Invalid due date!" });
    if (!assignees || !Array.isArray(assignees) || assignees.length === 0)
      throw createError({
        statusCode: 400,
        statusMessage: "At least one assigned member is required!",
      });
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
    const project = await db.query.project.findFirst({
      where: {
        id: projectId,
        workspace_id: workspaceId,
      },
    });
    if (!project) throw createError({ statusCode: 400, statusMessage: "Invalid project!" });
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
    const [task] = await db
      .insert(tables.task)
      .values({
        name,
        project_id: project.id,
        description,
        created_at: new Date(),
        updated_at: new Date(),
        priority: priorityValue,
        status: statusValue,
        due_date: parsedDueDate,
      })
      .returning();

    if (!task) {
      throw createError({ statusCode: 500, statusMessage: "Failed to create task!" });
    }

    if (subtasks && subtasks.length > 0) {
      const subtaskValues = subtasks.map((subtask) => ({
        created_at: new Date(),
        updated_at: new Date(),
        name: subtask.name,
        task_id: task.id,
        is_completed: subtask.is_completed,
      }));
      await db.insert(tables.subtasks).values(subtaskValues);
    }
    const assigneeValues = assignees.map((member) => ({
      task_id: task.id,
      member_id: member.member_id,
      assigned_at: new Date(),
    }));
    await db.insert(tables.task_assignees).values(assigneeValues);
    const users = await db.query.workspace_members.findMany({
      where: { id: { in: memberIds } },
      with: {
        user: true,
      },
    });
    const workspace = await db.query.workspace.findFirst({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid workspace!",
      });
    }
    await Promise.all(
      users
        .filter((member) => member.user?.email && member.user_id !== session.user.id)
        .map((member) =>
          sendTaskAssignmentEmail({
            email: member.user!.email,
            user: member.user!.username,
            addedBy: session.user.username,
            project: project.title,
            workspace: workspace.name,
            link: `${appLink}/workspace/${workspaceId}/projects/${project.id}`,
            task: task.name,
          }),
        ),
    );
    return {
      message: "Task created successfully",
      task,
    };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: `Create task error: ${errorMessage}!`,
    });
  }
});
