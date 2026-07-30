import type { Priority, ProjectMembers, Status } from "~~/shared/types";
import { and, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { PRIORITY, STATUS } from "~~/server/database/enums";
import { sendProjectCompletionMail } from "~~/server/libs/emails/actions/completed-project";
import { sendProjectAssignmentEmail } from "~~/server/libs/emails/actions/send-project-assignment";
import { validPriorities, validStatuses } from "~~/shared/types";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const workspaceId = getRouterParam(event, "workspaceId");
    const projectId = getRouterParam(event, "projectId");

    const body = (await readBody(event)) as {
      description?: string;
      dueDate?: string | null;
      title?: string;
      status?: Status;
      priority?: Priority;
      members?: ProjectMembers[];
    };

    if (!session) throw createError({ statusCode: 401, statusMessage: "Unauthorized!" });
    if (!workspaceId || typeof workspaceId !== "string")
      throw createError({ statusCode: 400, statusMessage: "WorkspaceID is required!" });
    if (!projectId || typeof projectId !== "string")
      throw createError({ statusCode: 400, statusMessage: "ProjectID is required!" });

    if (body.title !== undefined && (typeof body.title !== "string" || !body.title))
      throw createError({ statusMessage: "Invalid title!", statusCode: 400 });
    if (
      body.status !== undefined &&
      (typeof body.status !== "string" || !validStatuses.includes(body.status))
    )
      throw createError({ statusMessage: "Invalid Status!", statusCode: 400 });
    if (
      body.priority !== undefined &&
      (typeof body.priority !== "string" || !validPriorities.includes(body.priority))
    )
      throw createError({ statusMessage: "Invalid Priority!", statusCode: 400 });
    if (body.description !== undefined && typeof body.description !== "string")
      throw createError({ statusMessage: "Invalid description!", statusCode: 400 });
    if (body.dueDate !== undefined && body.dueDate !== null && typeof body.dueDate !== "string")
      throw createError({ statusMessage: "Invalid due date!", statusCode: 400 });

    const parsedDueDate = body.dueDate
      ? new Date(body.dueDate)
      : body.dueDate === null
        ? null
        : undefined;
    if (parsedDueDate && Number.isNaN(parsedDueDate.getTime()))
      throw createError({ statusMessage: "Invalid due date!", statusCode: 400 });

    if (body.members !== undefined) {
      if (!Array.isArray(body.members) || body.members.length === 0) {
        throw createError({ statusCode: 400, statusMessage: "At least one member is required!" });
      }
      for (const member of body.members) {
        if (!member || typeof member !== "object")
          throw createError({ statusMessage: "Invalid member format!", statusCode: 400 });
        if (typeof member.member_id !== "string" || !member.member_id)
          throw createError({
            statusMessage: "Each member must have a valid id!",
            statusCode: 400,
          });
      }
    }

    const statusValue = body.status ? STATUS[body.status as keyof typeof STATUS] : undefined;
    const priorityValue = body.priority
      ? PRIORITY[body.priority as keyof typeof PRIORITY]
      : undefined;

    const workspace = await db.query.workspace.findFirst({
      where: { id: workspaceId },
    });
    if (!workspace) throw createError({ statusCode: 400, statusMessage: "Invalid Workspace!" });

    const project = await db.query.project.findFirst({
      where: {
        id: projectId,
        workspace_id: workspaceId,
      },
    });
    if (!project) throw createError({ statusCode: 400, statusMessage: "Invalid Project!" });

    const updateData: Record<string, any> = { updated_at: new Date() };
    if (statusValue !== undefined) updateData.status = statusValue;
    if (priorityValue !== undefined) updateData.priority = priorityValue;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (parsedDueDate !== undefined) updateData.due_date = parsedDueDate;

    if (Object.keys(updateData).length > 1) {
      await db
        .update(tables.project)
        .set(updateData)
        .where(and(eq(tables.project.id, projectId), eq(tables.project.workspace_id, workspaceId)));
    }

    if (body.members !== undefined) {
      const memberIds = body.members.map((m) => m.member_id);

      const validMembers = await db.query.workspace_members.findMany({
        where: {
          id: { in: memberIds },
          workspace_id: workspaceId,
        },
        columns: { id: true },
      });

      const validIds = validMembers.map((m) => m.id);
      const invalid = memberIds.filter((id) => !validIds.includes(id));
      if (invalid.length) {
        throw createError({
          statusCode: 400,
          statusMessage: `Invalid members (not in workspace): ${invalid.join(", ")}`,
        });
      }

      const existingMembers = await db.query.project_members.findMany({
        where: { project_id: projectId },
        columns: { member_id: true },
      });
      const existingMemberIds = existingMembers.map((m) => m.member_id);

      await db
        .delete(tables.project_members)
        .where(eq(tables.project_members.project_id, projectId));

      const now = new Date();
      const newMembers = body.members.map((m) => ({
        project_id: projectId,
        member_id: m.member_id,
        created_at: now,
        updated_at: now,
      }));

      await db.insert(tables.project_members).values(newMembers);

      const newMemberIds = memberIds.filter(
        (id) => !existingMemberIds.includes(id) && id !== session.user.id,
      );

      if (newMemberIds.length > 0) {
        const usersToNotify = await db.query.workspace_members.findMany({
          where: { id: { in: newMemberIds } },
          with: { user: true },
        });

        for (const member of usersToNotify) {
          if (!member.user?.email || member.user_id === session.user.id) continue;

          await sendProjectAssignmentEmail({
            email: member.user.email,
            user: member.user.username,
            addedBy: session.user.username,
            project: body.title ?? project.title,
            workspace: workspace.name,
            link: `${process.env.NUXT_PUBLIC_SITE_URL}/workspace/${workspace.id}/projects/${projectId}`,
          });
        }
      }
    }

    if (body.status === "COMPLETED") {
      const projectMembers = await db.query.project_members.findMany({
        where: { project_id: projectId },
        with: {
          member: {
            with: { user: true },
          },
        },
      });

      for (const pm of projectMembers.filter((m) => m.member?.user)) {
        await sendProjectCompletionMail({
          workspace: workspace.name,
          user: pm.member!.user!.username,
          project: project.title,
          completedBy: session.user.id === pm.member!.user!.id ? "You" : session.user.username,
          link: `${process.env.NUXT_PUBLIC_SITE_URL}/workspace/${workspace.id}/projects/${project.id}`,
          email: pm.member!.user!.email,
        });
      }
    }

    return { message: "Project updated successfully!" };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({ statusCode: error.statusCode ?? 500, statusMessage: `${errorMessage}!` });
  }
});
