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

    const { title, status, dueDate, description, priority, members } = (await readBody(event)) as {
      description: string;
      dueDate: Date | undefined;
      title: string;
      status: Status;
      priority: Priority;
      members: ProjectMembers[];
    };

    if (!session) throw createError({ statusCode: 401, statusMessage: "Unauthorized!" });
    if (!workspaceId || typeof workspaceId !== "string")
      throw createError({ statusCode: 400, statusMessage: "WorkspaceID is required!" });
    if (!projectId || typeof projectId !== "string")
      throw createError({ statusCode: 400, statusMessage: "ProjectID is required!" });

    if (typeof title !== "string" || !title)
      throw createError({ statusMessage: "Invalid title!", statusCode: 400 });
    if (typeof status !== "string" || !validStatuses.includes(status))
      throw createError({ statusMessage: "Invalid Status!", statusCode: 400 });
    if (typeof priority !== "string" || !validPriorities.includes(priority))
      throw createError({ statusMessage: "Invalid Priority!", statusCode: 400 });
    if (description !== undefined && typeof description !== "string")
      throw createError({ statusMessage: "Invalid description!", statusCode: 400 });
    if (dueDate != null && typeof dueDate !== "string")
      throw createError({ statusMessage: "Invalid due date!", statusCode: 400 });

    const parsedDueDate = dueDate ? new Date(dueDate) : undefined;
    if (parsedDueDate && Number.isNaN(parsedDueDate.getTime()))
      throw createError({ statusMessage: "Invalid due date!", statusCode: 400 });

    if (!members || !Array.isArray(members) || members.length === 0) {
      throw createError({ statusCode: 400, statusMessage: "At least one member is required!" });
    }

    for (const member of members) {
      if (!member || typeof member !== "object")
        throw createError({ statusMessage: "Invalid member format!", statusCode: 400 });
      if (typeof member.member_id !== "string" || !member.member_id)
        throw createError({ statusMessage: "Each member must have a valid id!", statusCode: 400 });
    }

    const statusValue = STATUS[status as keyof typeof STATUS];
    const priorityValue = PRIORITY[priority as keyof typeof PRIORITY];

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

    const memberIds = members.map((m) => m.member_id);

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

    await db
      .update(tables.project)
      .set({
        updated_at: new Date(),
        status: statusValue,
        description,
        due_date: parsedDueDate ?? null,
        priority: priorityValue,
        title,
      })
      .where(and(eq(tables.project.id, projectId), eq(tables.project.workspace_id, workspaceId)));

    const existingMembers = await db.query.project_members.findMany({
      where: { project_id: projectId },
      columns: {
        member_id: true,
      },
    });
    const existingMemberIds = existingMembers.map((m) => m.member_id);

    await db.delete(tables.project_members).where(eq(tables.project_members.project_id, projectId));

    const now = new Date();
    const newMembers = members.map((m) => ({
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
        with: {
          user: true,
        },
      });

      for (const member of usersToNotify) {
        if (!member.user?.email || member.user_id === session.user.id) continue;

        await sendProjectAssignmentEmail({
          email: member.user.email,
          user: member.user.username,
          addedBy: session.user.username,
          project: title,
          workspace: workspace.name,
          link: `${process.env.NUXT_PUBLIC_SITE_URL}/workspace/${workspace.id}/projects/${projectId}`,
        });
      }
    }

    if (status === "COMPLETED") {
      const membersToNotify = await db.query.workspace_members.findMany({
        where: { id: { in: validIds } },
        with: {
          user: true,
        },
      });

      for (const member of membersToNotify.filter((m) => m.user)) {
        await sendProjectCompletionMail({
          workspace: workspace.name,
          user: member.user!.username,
          project: project.title,
          completedBy: session.user.id === member.user!.id ? "You" : session.user.username,
          link: `${process.env.NUXT_PUBLIC_SITE_URL}/workspace/${workspace.id}/projects/${project.id}`,
          email: member.user!.email,
        });
      }
    }

    return { message: "Project updated successfully!" };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({ statusCode: error.statusCode ?? 500, statusMessage: `${errorMessage}!` });
  }
});
