import type { ProjectMembers } from "~~/shared/types";
import { and, eq, inArray } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized!",
      });
    }
    const userId = session.user.id;
    const workspaceId = getRouterParam(event, "workspaceId");
    if (!workspaceId || typeof workspaceId !== "string") {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid workspaceId!",
      });
    }
    const projects = await db
      .select({
        id: tables.project.id,
        title: tables.project.title,
        description: tables.project.description,
        status: tables.project.status,
        priority: tables.project.priority,
        dueDate: tables.project.due_date,
        workspaceId: tables.project.workspace_id,
        createdAt: tables.project.created_at,
        updatedAt: tables.project.updated_at,
      })
      .from(tables.project)
      .innerJoin(tables.project_members, eq(tables.project_members.project_id, tables.project.id))
      .innerJoin(
        tables.workspace_members,
        eq(tables.workspace_members.id, tables.project_members.member_id),
      )
      .where(
        and(
          eq(tables.workspace_members.user_id, userId),
          eq(tables.workspace_members.workspace_id, workspaceId),
        ),
      );
    const uniqueProjects = projects.reduce(
      (acc, project) => {
        if (!acc.some((p) => p.id === project.id)) {
          acc.push(project);
        }
        return acc;
      },
      [] as typeof projects,
    );
    if (uniqueProjects.length === 0) {
      return [];
    }
    const projectIds = uniqueProjects.map((p) => p.id);
    const membersRaw = await db
      .select({
        projectId: tables.project_members.project_id,
        email: tables.user.email,
        avatar: tables.user.profile_picture_url,
        username: tables.user.username,
        member_id: tables.workspace_members.id,
      })
      .from(tables.project_members)
      .innerJoin(
        tables.workspace_members,
        eq(tables.workspace_members.id, tables.project_members.member_id),
      )
      .innerJoin(tables.user, eq(tables.user.id, tables.workspace_members.user_id))
      .where(
        and(
          eq(tables.workspace_members.workspace_id, workspaceId),
          inArray(tables.project_members.project_id, projectIds),
        ),
      );
    const membersByProject = new Map<string, ProjectMembers[]>();
    for (const member of membersRaw) {
      if (!membersByProject.has(member.projectId)) {
        membersByProject.set(member.projectId, []);
      }
      membersByProject.get(member.projectId)?.push({
        email: member.email,
        avatar: member.avatar,
        username: member.username,
        member_id: member.member_id,
      });
    }
    const projectsWithMembers = uniqueProjects.map((project) => ({
      ...project,
      members: membersByProject.get(project.id) || [],
    }));
    return projectsWithMembers;
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      statusMessage: `Failed to fetch projects: ${errorMessage}!`,
    });
  }
});
