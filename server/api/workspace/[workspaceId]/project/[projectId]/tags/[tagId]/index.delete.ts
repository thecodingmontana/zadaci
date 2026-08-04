import { and, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const workspaceId = getRouterParam(event, "workspaceId");
  const projectId = getRouterParam(event, "projectId");
  const tagId = getRouterParam(event, "tagId");

  if (!workspaceId || !projectId || !tagId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing workspaceId, projectId or tagId",
    });
  }

  const membership = await db.query.workspace_members.findFirst({
    where: { user_id: session.user.id, workspace_id: workspaceId },
  });
  if (!membership) {
    throw createError({ statusCode: 403, statusMessage: "Access denied" });
  }

  await db
    .delete(tables.project_tags)
    .where(
      and(eq(tables.project_tags.project_id, projectId), eq(tables.project_tags.tag_id, tagId)),
    );

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
