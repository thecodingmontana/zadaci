import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const workspaceId = getRouterParam(event, "workspaceId");

  if (!workspaceId) {
    throw createError({ statusCode: 400, statusMessage: "Missing workspaceId" });
  }

  const membership = await db.query.workspace_members.findFirst({
    where: { user_id: session.user.id, workspace_id: workspaceId },
  });
  if (!membership) {
    throw createError({ statusCode: 403, statusMessage: "Access denied" });
  }

  const { name, color } = await readBody<{ name: string; color?: string }>(event);
  if (!name || typeof name !== "string" || !name.trim()) {
    throw createError({ statusCode: 400, statusMessage: "Tag name is required" });
  }

  const now = new Date();
  const [tag] = await db
    .insert(tables.tag)
    .values({
      workspace_id: workspaceId,
      name: name.trim(),
      color: color ?? null,
      created_at: now,
      updated_at: now,
    })
    .returning();

  if (!tag) {
    throw createError({ statusCode: 500, statusMessage: "Failed to create tag" });
  }

  return {
    id: tag.id,
    workspace_id: tag.workspace_id,
    name: tag.name,
    color: tag.color,
    created_at: tag.created_at.toISOString(),
    updated_at: tag.updated_at.toISOString(),
    deleted_at: null,
  };
});
