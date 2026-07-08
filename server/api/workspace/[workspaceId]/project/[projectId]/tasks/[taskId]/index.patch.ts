import type { Status } from "~~/shared/types";
import { and, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { STATUS } from "~~/server/database/enums";
import { sendTaskCompletionMail } from "~~/server/libs/emails/actions/completed-task";
import { validStatuses } from "~~/shared/types";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const workspaceId = getRouterParam(event, "workspaceId");
    const projectId = getRouterParam(event, "projectId");
    const taskId = getRouterParam(event, "taskId");
    const { status } = (await readBody(event)) as { status: Status };
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
    if (typeof status !== "string" || !validStatuses.includes(status)) {
      throw createError({
        statusMessage: "Invalid Status!",
        statusCode: 400,
      });
    }

    const statusValue = STATUS[status as keyof typeof STATUS];

    const project = await db.query.project.findFirst({
      where: {
        id: projectId,
        workspace_id: workspaceId,
      },
      with: {
        members: {
          with: {
            member: {
              with: {
                user: true,
              },
            },
          },
        },
        workspace: {
          columns: {
            name: true,
            id: true,
          },
        },
      },
    });
    if (!project) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid Project!",
      });
    }
    if (!project.workspace) {
      throw createError({
        statusCode: 400,
        statusMessage: "Project workspace not found!",
      });
    }
    const [task] = await db
      .update(tables.task)
      .set({
        updated_at: new Date(),
        status: statusValue,
      })
      .where(and(eq(tables.task.id, taskId), eq(tables.task.project_id, projectId)))
      .returning();

    if (!task) {
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to update task status!",
      });
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
    if (status === "COMPLETED") {
      await Promise.all(
        project.members
          .filter((project_member) => project_member.member?.user)
          .map((project_member) =>
            sendTaskCompletionMail({
              workspace: project.workspace!.name,
              user: project_member.member!.user!.username,
              project: project.title,
              completedBy:
                session.user.id === project_member.member!.user!.id ? "You" : session.user.username,
              link: `${process.env.NUXT_PUBLIC_SITE_URL}/workspace/${project.workspace!.id}/projects/${project.id}`,
              email: project_member.member!.user!.email,
              task: task.name,
            }),
          ),
      );
    }
    return { message: "Task status updated successfully!" };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      statusMessage: `Update Project status: ${errorMessage}!`,
    });
  }
});
