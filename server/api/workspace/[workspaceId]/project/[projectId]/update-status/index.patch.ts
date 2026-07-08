import type { Status } from "~~/shared/types";
import { and, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { STATUS } from "~~/server/database/enums";
import { sendProjectCompletionMail } from "~~/server/libs/emails/actions/completed-project";
import { validStatuses } from "~~/shared/types";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const workspaceId = getRouterParam(event, "workspaceId");
    const projectId = getRouterParam(event, "projectId");
    const { status } = (await readBody(event)) as { status: Status };
    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized!",
      });
    }
    if (!workspaceId || typeof workspaceId !== "string") {
      throw createError({
        statusCode: 400,
        statusMessage: "WorkspaceID is required!",
      });
    }
    if (!projectId || typeof projectId !== "string") {
      throw createError({
        statusCode: 400,
        statusMessage: "ProjectID is required!",
      });
    }
    if (typeof status !== "string" || !validStatuses.includes(status)) {
      throw createError({
        statusMessage: "Invalid Status!",
        statusCode: 400,
      });
    }

    const statusValue = STATUS[status as keyof typeof STATUS];

    const workspace = await db.query.workspace.findFirst({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid Workspace!",
      });
    }

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
      },
    });
    if (!project) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid Project!",
      });
    }

    await db
      .update(tables.project)
      .set({
        updated_at: new Date(),
        status: statusValue,
      })
      .where(and(eq(tables.project.id, projectId), eq(tables.project.workspace_id, workspaceId)));

    if (status === "COMPLETED") {
      for (const project_member of project.members.filter((m) => m.member?.user)) {
        await sendProjectCompletionMail({
          workspace: workspace.name,
          user: project_member.member!.user!.username,
          project: project.title,
          completedBy:
            session.user.id === project_member.member!.user!.id ? "You" : session.user.username,
          link: `${process.env.NUXT_PUBLIC_SITE_URL}/workspace/${workspace.id}/projects/${project.id}`,
          email: project_member.member!.user!.email,
        });
      }
    }
    return {
      message: "Project status updated successfully!",
    };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      statusMessage: `Update Project status: ${errorMessage}!`,
    });
  }
});
