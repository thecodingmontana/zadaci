import { eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const workspaceId = getRouterParam(event, "workspaceId");
  const projectId = getRouterParam(event, "projectId");

  if (!workspaceId || !projectId) {
    throw createError({ statusCode: 400, statusMessage: "Missing workspaceId or projectId" });
  }

  const membership = await db.query.workspace_members.findFirst({
    where: { user_id: session.user.id, workspace_id: workspaceId },
  });
  if (!membership) {
    throw createError({ statusCode: 403, statusMessage: "Access denied" });
  }

  const body = await readBody<{ tagIds: string[] }>(event);
  const tagIds = Array.isArray(body?.tagIds) ? body.tagIds : [];
  if (tagIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "tagIds is required" });
  }

  const now = new Date();

  for (const tagId of tagIds) {
    if (typeof tagId !== "string" || !tagId) continue;

    const tag = await db.query.tag.findFirst({
      where: { id: tagId, workspace_id: workspaceId },
      columns: { id: true },
    });
    if (!tag) continue;

    const existing = await db.query.project_tags.findFirst({
      where: { project_id: projectId, tag_id: tagId },
      columns: { id: true },
    });
    if (existing) continue;

    await db.insert(tables.project_tags).values({
      project_id: projectId,
      tag_id: tagId,
      created_at: now,
      updated_at: now,
    });
  }

  const rows = await db
    .select({
      id: tables.tag.id,
      name: tables.tag.name,
      color: tables.tag.color,
    })
    .from(tables.project_tags)
    .innerJoin(tables.tag, eq(tables.project_tags.tag_id, tables.tag.id))
    .where(eq(tables.project_tags.project_id, projectId));

  return rows;
});
