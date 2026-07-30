import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

interface TrashItem {
  id: string;
  entityType: string;
  title: string;
  parentTitle: string | null;
  deletedAt: string;
  updatedAt: string;
}

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

    const membership = await db.query.workspace_members.findFirst({
      where: { workspace_id: workspaceId, user_id: session.user.id },
    });
    if (!membership) {
      throw createError({ statusCode: 403, statusMessage: "Not a member of this workspace" });
    }

    const items: TrashItem[] = [];

    // Projects
    const projects = await db
      .select({
        id: tables.project.id,
        title: tables.project.title,
        deleted_at: tables.project.deleted_at,
        updated_at: tables.project.updated_at,
      })
      .from(tables.project)
      .where(
        and(eq(tables.project.workspace_id, workspaceId), isNotNull(tables.project.deleted_at)),
      )
      .orderBy(desc(tables.project.deleted_at));
    for (const p of projects) {
      items.push({
        id: p.id,
        entityType: "project",
        title: p.title,
        parentTitle: null,
        deletedAt: p.deleted_at!.toISOString(),
        updatedAt: p.updated_at.toISOString(),
      });
    }

    // Channels
    const channels = await db
      .select({
        id: tables.channel.id,
        name: tables.channel.name,
        deleted_at: tables.channel.deleted_at,
        updated_at: tables.channel.updated_at,
      })
      .from(tables.channel)
      .where(
        and(eq(tables.channel.workspace_id, workspaceId), isNotNull(tables.channel.deleted_at)),
      )
      .orderBy(desc(tables.channel.deleted_at));
    for (const c of channels) {
      items.push({
        id: c.id,
        entityType: "channel",
        title: c.name,
        parentTitle: null,
        deletedAt: c.deleted_at!.toISOString(),
        updatedAt: c.updated_at.toISOString(),
      });
    }

    // Teams
    const teams = await db
      .select({
        id: tables.team.id,
        name: tables.team.name,
        deleted_at: tables.team.deleted_at,
        updated_at: tables.team.updated_at,
      })
      .from(tables.team)
      .where(and(eq(tables.team.workspace_id, workspaceId), isNotNull(tables.team.deleted_at)))
      .orderBy(desc(tables.team.deleted_at));
    for (const t of teams) {
      items.push({
        id: t.id,
        entityType: "team",
        title: t.name,
        parentTitle: null,
        deletedAt: t.deleted_at!.toISOString(),
        updatedAt: t.updated_at.toISOString(),
      });
    }

    // Tags
    const tags = await db
      .select({
        id: tables.tag.id,
        name: tables.tag.name,
        deleted_at: tables.tag.deleted_at,
        updated_at: tables.tag.updated_at,
      })
      .from(tables.tag)
      .where(and(eq(tables.tag.workspace_id, workspaceId), isNotNull(tables.tag.deleted_at)))
      .orderBy(desc(tables.tag.deleted_at));
    for (const t of tags) {
      items.push({
        id: t.id,
        entityType: "tag",
        title: t.name,
        parentTitle: null,
        deletedAt: t.deleted_at!.toISOString(),
        updatedAt: t.updated_at.toISOString(),
      });
    }

    // Notes
    const notes = await db
      .select({
        id: tables.note.id,
        title: tables.note.title,
        deleted_at: tables.note.deleted_at,
        updated_at: tables.note.updated_at,
      })
      .from(tables.note)
      .where(and(eq(tables.note.workspace_id, workspaceId), isNotNull(tables.note.deleted_at)))
      .orderBy(desc(tables.note.deleted_at));
    for (const n of notes) {
      items.push({
        id: n.id,
        entityType: "note",
        title: n.title,
        parentTitle: null,
        deletedAt: n.deleted_at!.toISOString(),
        updatedAt: n.updated_at.toISOString(),
      });
    }

    // Tasks (join with project for parent title)
    const tasks = await db
      .select({
        id: tables.task.id,
        name: tables.task.name,
        project_id: tables.task.project_id,
        deleted_at: tables.task.deleted_at,
        updated_at: tables.task.updated_at,
      })
      .from(tables.task)
      .innerJoin(tables.project, eq(tables.task.project_id, tables.project.id))
      .where(and(eq(tables.project.workspace_id, workspaceId), isNotNull(tables.task.deleted_at)))
      .orderBy(desc(tables.task.deleted_at));
    for (const t of tasks) {
      const parentProject = projects.find((p) => p.id === t.project_id);
      items.push({
        id: t.id,
        entityType: "task",
        title: t.name,
        parentTitle: parentProject?.title ?? null,
        deletedAt: t.deleted_at!.toISOString(),
        updatedAt: t.updated_at.toISOString(),
      });
    }

    // Sort all items by deletedAt desc
    items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));

    return { items };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || "Internal server error",
    });
  }
});
