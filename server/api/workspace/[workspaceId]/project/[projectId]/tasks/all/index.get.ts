import { db } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const workspaceId = getRouterParam(event, "workspaceId");
    const projectId = getRouterParam(event, "projectId");
    if (!session) {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized!" });
    }
    if (!workspaceId || typeof workspaceId !== "string") {
      throw createError({ statusCode: 400, statusMessage: "Workspace ID is required!" });
    }
    if (!projectId || typeof projectId !== "string") {
      throw createError({ statusCode: 400, statusMessage: "Project ID is required!" });
    }
    const workspace = await db.query.workspace.findFirst({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw createError({ statusCode: 400, statusMessage: "Invalid workspace!" });
    }
    const project = await db.query.project.findFirst({
      where: {
        id: projectId,
        workspace_id: workspaceId,
      },
    });
    if (!project) {
      throw createError({ statusCode: 400, statusMessage: "Invalid project!" });
    }
    const tasks = await db.query.task.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: "desc" },
      with: {
        subtasks: true,
        assignees: {
          with: {
            member: {
              with: {
                user: true,
              },
            },
          },
        },
      },
    });
    return tasks.map((task) => ({
      id: task.id,
      name: task.name,
      status: task.status,
      dueDate: task.due_date ? task.due_date.toISOString() : null,
      description: task.description,
      priority: task.priority,
      createdAt: task.created_at.toISOString(),
      updatedAt: task.updated_at.toISOString(),
      projectId: task.project_id,
      subtasks: task.subtasks.map((subtask) => ({
        id: subtask.id,
        name: subtask.name,
        is_completed: subtask.is_completed,
        createdAt: subtask.created_at.toISOString(),
        updatedAt: subtask.updated_at.toISOString(),
      })),
      assignees: task.assignees
        .filter((assignee) => assignee.member?.user)
        .map((assignee) => ({
          member_id: assignee.member!.id,
          username: assignee.member!.user!.username,
          email: assignee.member!.user!.email,
          avatar: assignee.member!.user!.profile_picture_url,
        })),
    }));
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: `Retrieve project tasks error: ${errorMessage}!`,
    });
  }
});
