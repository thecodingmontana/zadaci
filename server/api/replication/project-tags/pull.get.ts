import { and, asc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface Checkpoint {
  updated_at: string;
  id: string;
}

interface PullResponse {
  documents: {
    id: string;
    project_id: string;
    tag_id: string;
    created_at: string;
    updated_at: string;
  }[];
  checkpoint: Checkpoint | null;
}

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const userId = session.user.id;

    const query = getQuery(event);
    const workspaceId = query.workspace_id as string | undefined;
    const checkpointParam = query.checkpoint as string | undefined;
    const batchSize = Math.min(Number(query.batch_size) || 50, 100);

    console.log(
      "[rxdb-debug] project-tags/pull | userId:",
      userId,
      "| workspaceId:",
      workspaceId,
      "| batchSize:",
      batchSize,
      "| hasCheckpoint:",
      !!checkpointParam,
    );

    if (!workspaceId) {
      return { documents: [], checkpoint: null } satisfies PullResponse;
    }

    const membership = await db.query.workspace_members.findFirst({
      where: { user_id: userId, workspace_id: workspaceId },
    });
    if (!membership) {
      throw createError({ statusCode: 403, statusMessage: "Access denied" });
    }

    const workspaceProjects = await db
      .select({ id: tables.project.id })
      .from(tables.project)
      .where(eq(tables.project.workspace_id, workspaceId));

    const projectIds = workspaceProjects.map((p) => p.id);
    if (projectIds.length === 0) {
      return { documents: [], checkpoint: null } satisfies PullResponse;
    }

    let checkpoint: Checkpoint | null = null;
    if (checkpointParam) {
      try {
        checkpoint = JSON.parse(checkpointParam) as Checkpoint;
      } catch {
        checkpoint = null;
      }
    }

    const conditions = [inArray(tables.project_tags.project_id, projectIds)];

    if (checkpoint) {
      conditions.push(
        or(
          gt(tables.project_tags.updated_at, new Date(checkpoint.updated_at)),
          and(
            sql`${tables.project_tags.updated_at} = ${checkpoint.updated_at}::timestamp with time zone`,
            gt(tables.project_tags.id, checkpoint.id),
          ),
        ),
      );
    }

    const rows = await db
      .select({
        id: tables.project_tags.id,
        project_id: tables.project_tags.project_id,
        tag_id: tables.project_tags.tag_id,
        created_at: tables.project_tags.created_at,
        updated_at: tables.project_tags.updated_at,
      })
      .from(tables.project_tags)
      .where(and(...conditions))
      .orderBy(asc(tables.project_tags.updated_at), asc(tables.project_tags.id))
      .limit(batchSize);

    const lastRow = rows[rows.length - 1];
    const nextCheckpoint: Checkpoint | null = lastRow
      ? {
          updated_at: lastRow.updated_at.toISOString(),
          id: lastRow.id,
        }
      : null;

    const documents = rows.map((row) => ({
      id: row.id,
      project_id: row.project_id,
      tag_id: row.tag_id,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    }));

    return { documents, checkpoint: nextCheckpoint } satisfies PullResponse;
  } catch (error: any) {
    if (error?.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      statusMessage: `Pull failed: ${error.message || "Unknown error"}`,
    });
  }
});
