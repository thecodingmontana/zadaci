import { and, asc, gt, or, sql } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface Checkpoint {
  updated_at: string;
  id: string;
}

interface PullResponse {
  documents: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    priority: string;
    project_id: string;
    due_date: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  }[];
  checkpoint: Checkpoint | null;
}

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const userId = session.user.id;

    const query = getQuery(event);
    const projectIdsParam = query.project_ids as string | undefined;
    const checkpointParam = query.checkpoint as string | undefined;
    const batchSize = Math.min(Number(query.batch_size) || 50, 100);

    if (!projectIdsParam) {
      return { documents: [], checkpoint: null } satisfies PullResponse;
    }

    const projectIds = projectIdsParam.split(",").filter(Boolean);
    if (projectIds.length === 0) {
      return { documents: [], checkpoint: null } satisfies PullResponse;
    }

    const membershipCheck = await db
      .select({ workspaceId: tables.project.workspace_id })
      .from(tables.project)
      .where(
        sql`${tables.project.id} IN (${sql.join(
          projectIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
      .innerJoin(
        tables.workspace_members,
        and(
          sql`${tables.workspace_members.workspace_id} = ${tables.project.workspace_id}`,
          sql`${tables.workspace_members.user_id} = ${userId}`,
        ),
      );

    if (membershipCheck.length === 0) {
      throw createError({ statusCode: 403, statusMessage: "Access denied" });
    }

    let checkpoint: Checkpoint | null = null;
    if (checkpointParam) {
      try {
        checkpoint = JSON.parse(checkpointParam) as Checkpoint;
      } catch {
        checkpoint = null;
      }
    }

    const projectIdsCondition = sql`${tables.task.project_id} IN (${sql.join(
      projectIds.map((id) => sql`${id}`),
      sql`, `,
    )})`;

    const conditions = [projectIdsCondition];

    if (checkpoint) {
      conditions.push(
        or(
          gt(tables.task.updated_at, new Date(checkpoint.updated_at)),
          and(
            sql`${tables.task.updated_at} = ${checkpoint.updated_at}::timestamp with time zone`,
            gt(tables.task.id, checkpoint.id),
          ),
        ),
      );
    }

    const rows = await db
      .select({
        id: tables.task.id,
        name: tables.task.name,
        description: tables.task.description,
        status: tables.task.status,
        priority: tables.task.priority,
        project_id: tables.task.project_id,
        due_date: tables.task.due_date,
        created_at: tables.task.created_at,
        updated_at: tables.task.updated_at,
        deleted_at: tables.task.deleted_at,
      })
      .from(tables.task)
      .where(and(...conditions))
      .orderBy(asc(tables.task.updated_at), asc(tables.task.id))
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
      name: row.name,
      description: row.description,
      status: row.status,
      priority: row.priority,
      project_id: row.project_id,
      due_date: row.due_date ? row.due_date.toISOString() : null,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
      deleted_at: row.deleted_at ? row.deleted_at.toISOString() : null,
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
