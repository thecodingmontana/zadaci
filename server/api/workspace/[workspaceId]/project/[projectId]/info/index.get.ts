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
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid workspace!",
      });
    }

    // fetch project
    const [project] = await db
      .select({
        id: tables.project.id,
        title: tables.project.title,
        description: tables.project.description,
        status: tables.project.status,
        priority: tables.project.priority,
        due_date: tables.project.due_date,
        created_at: tables.project.created_at,
        updated_at: tables.project.updated_at,
        workspace_id: tables.project.workspace_id,
      })
      .from(tables.project)
      .where(and(eq(tables.project.id, projectId), eq(tables.project.workspace_id, workspaceId)));

    if (!project) {
      throw createError({ statusCode: 404, statusMessage: "Project not found" });
    }

    // fetch members
    const members = await db
      .select({
        member_id: tables.project_members.member_id,
        email: tables.user.email,
        username: tables.user.username,
        avatar: tables.user.profile_picture_url,
      })
      .from(tables.project_members)
      .innerJoin(tables.user, eq(tables.project_members.member_id, tables.user.id))
      .where(eq(tables.project_members.project_id, projectId));

    return {
      ...project,
      members,
    };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      statusMessage: `${errorMessage}!`,
    });
  }
});
