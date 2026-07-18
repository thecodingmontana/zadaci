import { inArray } from "drizzle-orm";
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

    const now = new Date();

    // Collect all descendant task IDs for soft-delete cascade
    const allTaskIds: string[] = [taskId];
    let currentBatch = [taskId];
    while (currentBatch.length > 0) {
      const children = await db
        .select({ id: tables.task.id })
        .from(tables.task)
        .where(inArray(tables.task.parent_task_id, currentBatch));
      const childIds = children.map((c) => c.id);
      allTaskIds.push(...childIds);
      currentBatch = childIds;
    }

    // Soft-delete task and all descendants
    await db
      .update(tables.task)
      .set({ deleted_at: now, updated_at: now })
      .where(inArray(tables.task.id, allTaskIds));

    return {
      message: "Task and its subtasks deleted successfully",
    };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      statusMessage: `Delete Task error: ${errorMessage}!`,
    });
  }
});
