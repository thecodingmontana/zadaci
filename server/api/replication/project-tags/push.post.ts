import { and, eq, inArray } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface PushRow {
  assumedMasterState: {
    id: string;
    updated_at: string;
  } | null;
  newDocumentState: {
    id: string;
    project_id: string;
    tag_id: string;
    created_at: string;
    updated_at: string;
  };
}

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const userId = session.user.id;

    const body = await readBody<PushRow[]>(event);
    if (!Array.isArray(body) || body.length === 0) {
      return [];
    }

    const query = getQuery(event);
    const workspaceId = query.workspace_id as string | undefined;
    if (!workspaceId) {
      throw createError({ statusCode: 400, statusMessage: "workspace_id is required" });
    }

    console.log(
      "[rxdb-debug] project-tags/push | userId:",
      userId,
      "| workspaceId:",
      workspaceId,
      "| rowCount:",
      body.length,
    );

    const membership = await db.query.workspace_members.findFirst({
      where: { user_id: userId, workspace_id: workspaceId },
    });
    if (!membership) {
      throw createError({ statusCode: 403, statusMessage: "Access denied" });
    }

    const projectIds = [...new Set(body.map((row) => row.newDocumentState.project_id))];

    const validProjects = await db
      .select({ id: tables.project.id })
      .from(tables.project)
      .where(
        and(eq(tables.project.workspace_id, workspaceId), inArray(tables.project.id, projectIds)),
      );

    const validProjectIdSet = new Set(validProjects.map((p) => p.id));
    const invalidRows = body.filter(
      (row) => !validProjectIdSet.has(row.newDocumentState.project_id),
    );
    if (invalidRows.length > 0) {
      throw createError({
        statusCode: 403,
        statusMessage: "Some rows reference projects not in this workspace",
      });
    }

    const ptIds = body.map((row) => row.newDocumentState.id);
    const existingPTs = await db
      .select({
        id: tables.project_tags.id,
        updated_at: tables.project_tags.updated_at,
        project_id: tables.project_tags.project_id,
        tag_id: tables.project_tags.tag_id,
        created_at: tables.project_tags.created_at,
      })
      .from(tables.project_tags)
      .where(inArray(tables.project_tags.id, ptIds));

    const existingMap = new Map(existingPTs.map((t) => [t.id, t]));
    const conflicts: any[] = [];

    for (const row of body) {
      const doc = row.newDocumentState;
      const existing = existingMap.get(doc.id);

      if (existing) {
        const assumedUpdatedAt = row.assumedMasterState?.updated_at;
        const currentUpdatedAt = existing.updated_at.toISOString();

        if (assumedUpdatedAt && assumedUpdatedAt !== currentUpdatedAt) {
          conflicts.push({
            id: existing.id,
            project_id: existing.project_id,
            tag_id: existing.tag_id,
            created_at: existing.created_at.toISOString(),
            updated_at: currentUpdatedAt,
          });
          continue;
        }
      }

      await db
        .insert(tables.project_tags)
        .values({
          id: doc.id,
          project_id: doc.project_id,
          tag_id: doc.tag_id,
          created_at: new Date(doc.created_at),
          updated_at: new Date(doc.updated_at),
        })
        .onConflictDoUpdate({
          target: tables.project_tags.id,
          set: {
            project_id: doc.project_id,
            tag_id: doc.tag_id,
            updated_at: new Date(doc.updated_at),
          },
        });
    }

    return conflicts;
  } catch (error: any) {
    if (error?.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      statusMessage: `Push failed: ${error.message || "Unknown error"}`,
    });
  }
});
