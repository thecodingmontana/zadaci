import { db } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const workspaceId = getRouterParam(event, "workspaceId");
    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized!",
      });
    }
    if (typeof workspaceId !== "string" || !workspaceId) {
      throw createError({
        statusMessage: "Invalid workspaceId!",
        statusCode: 400,
      });
    }
    const user = await db.query.user.findFirst({
      where: { id: session.user.id },
    });
    if (!user) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid User!",
      });
    }
    const projects = await db.query.project.findMany({
      where: { workspace_id: workspaceId },
      with: {
        tasks: true,
      },
    });
    const allTasks = projects.flatMap((project) => project.tasks);
    return allTasks.map((task) => ({
      id: task.id,
      name: task.name,
      status: task.status,
      dueDate: task.due_date ? task.due_date.toISOString() : null,
      description: task.description,
      priority: task.priority,
      createdAt: task.created_at.toISOString(),
      updatedAt: task.updated_at.toISOString(),
      projectId: task.project_id,
    }));
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      statusMessage: `Retrieve Tasks Error: ${errorMessage}!`,
    });
  }
});
