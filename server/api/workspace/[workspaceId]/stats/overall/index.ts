import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { STATUS } from "~~/server/database/enums";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const workspaceId = getRouterParam(event, "workspaceId");
    if (!session) {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized!" });
    }
    if (typeof workspaceId !== "string" || !workspaceId) {
      throw createError({ statusCode: 400, statusMessage: "Invalid workspaceId!" });
    }
    const user = await db.query.user.findFirst({
      where: { id: session.user.id },
    });
    if (!user) {
      throw createError({ statusCode: 400, statusMessage: "Invalid User!" });
    }
    const activeProjects = await db
      .select({
        id: tables.project.id,
      })
      .from(tables.project)
      .where(
        and(
          eq(tables.project.workspace_id, workspaceId),
          ne(tables.project.status, STATUS.COMPLETED),
        ),
      );
    const projectIds = activeProjects.map((p) => p.id);
    const totalProjects = activeProjects.length;
    const statusCounts = await db
      .select({
        status: tables.task.status,
        count: sql<number>`count(*)::int`,
      })
      .from(tables.task)
      .where(inArray(tables.task.project_id, projectIds))
      .groupBy(tables.task.status);
    let totalTasks = 0;
    let totalTasksInProgress = 0;
    let totalTasksCompleted = 0;
    for (const row of statusCounts) {
      totalTasks += row.count;
      if (row.status === STATUS.IN_PROGRESS) totalTasksInProgress = row.count;
      if (row.status === STATUS.COMPLETED) totalTasksCompleted = row.count;
    }
    return {
      totalProjects,
      totalTasks,
      totalTasksInProgress,
      totalTasksCompleted,
    };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: `Retrieve Overall Stats Error: ${errorMessage}!`,
    });
  }
});
