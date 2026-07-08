import type { Priority, ProjectMembers, Status } from "~~/shared/types";
import { db, tables } from "~~/server/database/db";
import { PRIORITY, STATUS } from "~~/server/database/enums";
import { sendProjectAssignmentEmail } from "~~/server/libs/emails/actions/send-project-assignment";
import { appLink, validPriorities, validStatuses } from "~~/shared/types";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const workspaceId = getRouterParam(event, "workspaceId");

    const { title, status, dueDate, description, priority, members } = (await readBody(event)) as {
      description: string;
      dueDate: Date | undefined;
      title: string;
      status: Status;
      priority: Priority;
      members: ProjectMembers[];
    };

    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized!",
      });
    }

    if (typeof workspaceId !== "string" || !workspaceId) {
      throw createError({
        statusMessage: "Invalid workspaceId!",
        statusCode: 400,
      });
    }

    if (typeof title !== "string" || !title) {
      throw createError({
        statusMessage: "Invalid title!",
        statusCode: 400,
      });
    }

    if (typeof status !== "string" || !validStatuses.includes(status)) {
      throw createError({
        statusMessage: "Invalid Status!",
        statusCode: 400,
      });
    }

    if (typeof priority !== "string" || !validPriorities.includes(priority)) {
      throw createError({
        statusMessage: "Invalid Priority!",
        statusCode: 400,
      });
    }

    if (description !== undefined && typeof description !== "string") {
      throw createError({
        statusMessage: "Invalid description!",
        statusCode: 400,
      });
    }

    if (dueDate !== undefined && typeof dueDate !== "string") {
      throw createError({
        statusMessage: "Invalid due date!",
        statusCode: 400,
      });
    }

    if (!members || !Array.isArray(members) || members.length === 0) {
      throw createError({ statusCode: 400, statusMessage: "At least one member is required!" });
    }

    for (const member of members) {
      if (!member || typeof member !== "object")
        throw createError({ statusMessage: "Invalid member format!", statusCode: 400 });
      if (typeof member.member_id !== "string" || !member.member_id)
        throw createError({ statusMessage: "Each member must have a valid id!", statusCode: 400 });
    }

    const parsedDueDate = dueDate ? new Date(dueDate) : undefined;

    if (parsedDueDate && Number.isNaN(parsedDueDate.getTime())) {
      throw createError({
        statusMessage: "Invalid due date!",
        statusCode: 400,
      });
    }

    const statusValue = STATUS[status as keyof typeof STATUS];
    const priorityValue = PRIORITY[priority as keyof typeof PRIORITY];

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

    let projectId: string | null = null;

    await db.transaction(async (tx) => {
      const [project] = await tx
        .insert(tables.project)
        .values({
          title,
          description,
          due_date: parsedDueDate,
          priority: priorityValue,
          status: statusValue,
          workspace_id: workspaceId,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning();

      if (!project) {
        throw createError({
          statusCode: 500,
          statusMessage: "Failed to create project!",
        });
      }

      if (members && members.length > 0) {
        const now = new Date();
        const newMembers = members.map((m) => ({
          project_id: project.id,
          member_id: m.member_id,
          created_at: now,
          updated_at: now,
        }));

        await tx.insert(tables.project_members).values(newMembers);
      }

      projectId = project.id;

      const users = await tx.query.workspace_members.findMany({
        where: { id: { in: memberIds } },
        with: {
          user: true,
        },
      });

      const workspace = await db.query.workspace.findFirst({
        where: { id: workspaceId },
      });

      if (!workspace) {
        throw createError({
          statusCode: 400,
          statusMessage: "Invalid workspace!",
        });
      }

      for (const member of users) {
        if (!member.user?.email || member.user_id === session.user.id) continue;

        await sendProjectAssignmentEmail({
          email: member.user.email,
          user: member.user.username,
          addedBy: session.user.username,
          project: title,
          workspace: workspace.name,
          link: `${appLink}/workspace/${workspaceId}/projects/${project.id}`,
        });
      }
    });

    return {
      message: "Project created successfully!",
      projectId: projectId || null,
    };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      statusMessage: `Workspace new project error: ${errorMessage}!`,
    });
  }
});
