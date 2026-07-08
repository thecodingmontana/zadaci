import { and, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const workspaceId = getRouterParam(event, "workspaceId");
    const projectId = getRouterParam(event, "projectId");
    const taskId = getRouterParam(event, "taskId");

    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized!",
      });
    }

    if (typeof workspaceId !== "string" || !workspaceId) {
      throw createError({ statusCode: 400, statusMessage: "Invalid workspace ID!" });
    }

    if (!projectId || typeof projectId !== "string") {
      throw createError({
        statusCode: 400,
        statusMessage: "ProjectID is required!",
      });
    }

    if (!taskId || typeof taskId !== "string") {
      throw createError({
        statusCode: 400,
        statusMessage: "taskID is required!",
      });
    }

    // Verify that the project exists
    const project = await db.query.project.findFirst({
      where: {
        id: projectId,
        workspace_id: workspaceId,
      },
    });

    if (!project) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid Project!",
      });
    }

    // check if task already exists
    const existingTask = await db.query.task.findFirst({
      where: {
        id: taskId,
        project_id: projectId,
      },
    });

    if (!existingTask) {
      throw createError({
        statusCode: 404,
        statusMessage: "Task not found!",
      });
    }

    // delete task
    await db
      .delete(tables.task)
      .where(and(eq(tables.task.id, taskId), eq(tables.task.project_id, projectId)));

    return {
      message: "Task deleted successfully",
    };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      statusMessage: `Create Task error: ${errorMessage}!`,
    });
  }
});
