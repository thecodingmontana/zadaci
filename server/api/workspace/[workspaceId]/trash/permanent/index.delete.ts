import { and, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

const entityMap: Record<string, { table: any; workspaceCheck: string }> = {
  project: { table: tables.project, workspaceCheck: "workspace_id" },
  task: { table: tables.task, workspaceCheck: "project_id" },
  channel: { table: tables.channel, workspaceCheck: "workspace_id" },
  team: { table: tables.team, workspaceCheck: "workspace_id" },
  tag: { table: tables.tag, workspaceCheck: "workspace_id" },
  note: { table: tables.note, workspaceCheck: "workspace_id" },
  message: { table: tables.message, workspaceCheck: "channel_id" },
  direct_message: { table: tables.direct_message, workspaceCheck: "conversation_id" },
  comment: { table: tables.comment, workspaceCheck: null },
  conversation: { table: tables.conversation, workspaceCheck: "workspace_id" },
  workspace_member: { table: tables.workspace_members, workspaceCheck: "workspace_id" },
};

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const workspaceId = getRouterParam(event, "workspaceId");

    if (!session) {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    }
    if (!workspaceId || typeof workspaceId !== "string") {
      throw createError({ statusCode: 400, statusMessage: "WorkspaceId is required" });
    }

    const body = await readBody<{ entityType: string; entityId: string }>(event);
    if (!body.entityType || !body.entityId) {
      throw createError({ statusCode: 400, statusMessage: "entityType and entityId are required" });
    }

    const entity = entityMap[body.entityType as string];
    if (!entity) {
      throw createError({
        statusCode: 400,
        statusMessage: `Unknown entity type: ${body.entityType}`,
      });
    }

    // Verify workspace membership
    const membership = await db.query.workspace_members.findFirst({
      where: { workspace_id: workspaceId, user_id: session.user.id },
    });
    if (!membership) {
      throw createError({ statusCode: 403, statusMessage: "Not a member of this workspace" });
    }

    // For project/task, verify workspace access
    const whereClauses = [eq(entity.table.id, body.entityId)];
    if (entity.workspaceCheck === "project_id") {
      const task = await db.query.task.findFirst({
        where: { id: body.entityId },
        columns: { id: true, project_id: true },
      });
      if (!task) throw createError({ statusCode: 404, statusMessage: "Item not found" });
      const project = await db.query.project.findFirst({
        where: { id: task.project_id },
        columns: { workspace_id: true },
      });
      if (!project || project.workspace_id !== workspaceId) {
        throw createError({ statusCode: 403, statusMessage: "Not authorized" });
      }
    } else if (entity.workspaceCheck) {
      whereClauses.push(eq(entity.table[entity.workspaceCheck], workspaceId));
    }

    await db.delete(entity.table).where(and(...whereClauses));

    return { message: `${body.entityType} permanently deleted` };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || "Internal server error",
    });
  }
});
