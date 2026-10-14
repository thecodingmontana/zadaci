import type { H3Event } from "h3";
import type { USER_ROLE } from "../database/enums";
import { and, eq, isNotNull } from "drizzle-orm";
import { db, tables } from "../database/db";
import { requireWorkspaceMember } from "./auth-helpers";

// Only the types the trash page lists; everything else is not restorable or deletable here.
const entityMap = {
  project: tables.project,
  task: tables.task,
  channel: tables.channel,
  team: tables.team,
  tag: tables.tag,
  note: tables.note,
} as const;

/** Checks access and returns the trashed row's table plus a WHERE scoped to this workspace. */
export async function resolveTrashedItem(event: H3Event, roles?: USER_ROLE[]) {
  const workspaceId = getRouterParam(event, "workspaceId");
  await requireWorkspaceMember(event, workspaceId, roles);

  const body = await readBody<{ entityType: string; entityId: string }>(event);
  if (!body?.entityType || !body.entityId) {
    throw createError({ statusCode: 400, statusMessage: "entityType and entityId are required" });
  }
  const table = entityMap[body.entityType as keyof typeof entityMap];
  if (!table) {
    throw createError({
      statusCode: 400,
      statusMessage: `Unknown entity type: ${body.entityType}`,
    });
  }

  if (table === tables.task) {
    const task = await db.query.task.findFirst({
      where: { id: body.entityId },
      columns: { project_id: true },
    });
    const project =
      task &&
      (await db.query.project.findFirst({
        where: { id: task.project_id },
        columns: { workspace_id: true },
      }));
    if (!project || project.workspace_id !== workspaceId) {
      throw createError({ statusCode: 404, statusMessage: "Item not found" });
    }
    return {
      table,
      where: and(eq(tables.task.id, body.entityId), isNotNull(tables.task.deleted_at)),
      entityType: body.entityType,
    };
  }

  const t = table as typeof tables.project;
  return {
    table,
    where: and(eq(t.id, body.entityId), eq(t.workspace_id, workspaceId!), isNotNull(t.deleted_at)),
    entityType: body.entityType,
  };
}
