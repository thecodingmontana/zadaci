import { and, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const workspaceId = getRouterParam(event, "workspaceId");
    const projectId = getRouterParam(event, "projectId");

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

    // check if workspace exists
    const workspace = await db.query.workspace.findFirst({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid workspace!",
      });
    }

    // check if project exists
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

    // update project
    await db
      .delete(tables.project)
      .where(and(eq(tables.project.id, projectId), eq(tables.project.workspace_id, workspaceId)));

    return {
      message: "Project deleted successfully!",
    };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      statusMessage: `${errorMessage}!`,
    });
  }
});
