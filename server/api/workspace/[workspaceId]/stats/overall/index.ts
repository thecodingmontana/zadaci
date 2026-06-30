import { and, eq, ne, inArray, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event)
    const workspaceId = getRouterParam(event, 'workspaceId')

    if (!session) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized!' })
    }

    if (typeof workspaceId !== 'string' || !workspaceId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid workspaceId!' })
    }

    const db = useDrizzle()

    const user = await db.query.userTable.findFirst({
      where: table => eq(table.id, session.user.id),
    })

    if (!user) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid User!' })
    }

    const activeProjects = await db.select({
      id: tables.projectTable.id,
    }).from(tables.projectTable).where(and(
      eq(tables.projectTable.workspace_id, workspaceId),
      ne(tables.projectTable.status, 'COMPLETED'),
    ))

    const projectIds = activeProjects.map(p => p.id)
    const totalProjects = activeProjects.length

    const statusCounts = await db.select({
      status: tables.tasksTable.status,
      count: sql<number>`count(*)::int`,
    }).from(tables.tasksTable).where(
      inArray(tables.tasksTable.project_id, projectIds),
    ).groupBy(tables.tasksTable.status)

    let totalTasks = 0
    let totalTasksInProgress = 0
    let totalTasksCompleted = 0
    for (const row of statusCounts) {
      totalTasks += row.count
      if (row.status === 'IN PROGRESS') totalTasksInProgress = row.count
      if (row.status === 'COMPLETED') totalTasksCompleted = row.count
    }

    return {
      totalProjects,
      totalTasks,
      totalTasksInProgress,
      totalTasksCompleted,
    }
  }
  catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: `Retrieve Overall Stats Error: ${errorMessage}!`,
    })
  }
})
