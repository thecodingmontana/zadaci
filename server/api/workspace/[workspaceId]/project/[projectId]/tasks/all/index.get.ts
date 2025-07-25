export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event)
    const workspaceId = getRouterParam(event, 'workspaceId')
    const projectId = getRouterParam(event, 'projectId')

    if (!session) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized!' })
    }

    if (!workspaceId || typeof workspaceId !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Workspace ID is required!' })
    }

    if (!projectId || typeof projectId !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Project ID is required!' })
    }

    // check if workspace exists
    const workspace = await useDrizzle().query.workspaceTable.findFirst({
      where: table => eq(table.id, workspaceId),
    })
    if (!workspace) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid workspace!' })
    }

    // check if project exists
    const project = await useDrizzle().query.projectTable.findFirst({
      where: table => and(
        eq(table.id, projectId),
        eq(table.workspace_id, workspaceId),
      ),
    })
    if (!project) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid project!' })
    }

    // retrieve all tasks for the project with subtasks and assignees
    const tasks = await useDrizzle().query.tasksTable.findMany({
      where: table => eq(table.project_id, projectId),
      orderBy: (table, { desc }) => desc(table.created_at),
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
    })

    return tasks.map(task => ({
      id: task.id,
      name: task.name,
      status: task.status,
      dueDate: task.due_date ? task.due_date.toISOString() : null,
      description: task.description,
      priority: task.priority,
      createdAt: task.created_at.toISOString(),
      updatedAt: task.updated_at.toISOString(),
      projectId: task.project_id,
      subtasks: task.subtasks.map(subtask => ({
        id: subtask.id,
        name: subtask.name,
        is_completed: subtask.is_completed,
        createdAt: subtask.created_at.toISOString(),
        updatedAt: subtask.updated_at.toISOString(),
      })),
      assignees: task.assignees.map(assignee => ({
        member_id: assignee.member.id,
        username: assignee.member.user.username,
        email: assignee.member.user.email,
        avatar: assignee.member.user.profile_picture_url,
      })),
    }))
  }
  catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: `Retrieve project tasks error: ${errorMessage}!`,
    })
  }
})
