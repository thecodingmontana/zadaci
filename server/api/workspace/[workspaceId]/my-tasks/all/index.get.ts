import { db } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    if (!session?.user?.id) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized!",
      });
    }

    const workspaceId = getRouterParam(event, "workspaceId");
    if (!workspaceId || typeof workspaceId !== "string") {
      throw createError({
        statusCode: 400,
        statusMessage: "WorkspaceId is required!",
      });
    }

    let userMembership;
    try {
      userMembership = await db.query.workspace_members.findFirst({
        where: {
          user_id: session.user.id,
          workspace_id: workspaceId,
        },
      });
    } catch (dbError: any) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to verify workspace membership: ${dbError.message || "Unknown error"}`,
      });
    }

    if (!userMembership) {
      return [];
    }

    let taskAssignees;
    try {
      taskAssignees = await db.query.task_assignees.findMany({
        where: {
          member_id: userMembership.id,
        },
        with: {
          task: {
            with: {
              assignees: {
                with: {
                  member: {
                    with: {
                      user: true,
                    },
                  },
                },
              },
              project: true,
            },
          },
        },
        orderBy: {
          assigned_at: "desc",
        },
      });
    } catch (dbError: any) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to fetch task assignments: ${dbError.message || "Unknown error"}`,
      });
    }

    const tasks = taskAssignees
      .filter((assignee) => assignee.task != null && assignee.task.project != null)
      .map((assignee) => {
        const task = assignee.task!;
        const project = task.project!;

        return {
          id: task.id,
          name: task.name,
          status: task.status,
          dueDate: task.due_date ? task.due_date.toISOString() : null,
          description: task.description,
          priority: task.priority,
          createdAt: task.created_at ? task.created_at.toISOString() : null,
          updatedAt: task.updated_at ? task.updated_at.toISOString() : null,
          projectId: task.project_id,
          parentTaskId: task.parent_task_id,
          assignees: (task.assignees ?? [])
            .filter((ta) => ta.member != null && ta.member.user != null)
            .map((ta) => {
              const member = ta.member!;
              const user = member.user!;
              return {
                member_id: member.id,
                email: user.email,
                username: user.username,
                avatar: user.profile_picture_url,
              };
            }),
          project: {
            id: project.id,
            title: project.title,
            status: project.status,
            priority: project.priority,
            dueDate: project.due_date,
            workspaceId: project.workspace_id,
          },
        };
      });

    return tasks;
  } catch (error: any) {
    if (error?.statusCode && error?.statusMessage) {
      throw error;
    }

    const errorMessage = error?.error?.message ?? error?.message ?? "Unknown error";
    throw createError({
      statusCode: 500,
      statusMessage: `My Tasks Error: ${errorMessage}!`,
    });
  }
});
