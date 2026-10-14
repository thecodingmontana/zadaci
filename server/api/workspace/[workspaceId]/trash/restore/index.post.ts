import { db } from "~~/server/database/db";
import { resolveTrashedItem } from "~~/server/libs/trash";

export default defineEventHandler(async (event) => {
  try {
    const { table, where, entityType } = await resolveTrashedItem(event);
    const now = new Date();
    await db.update(table).set({ deleted_at: null, updated_at: now }).where(where);
    return { message: `${entityType} restored successfully` };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || "Internal server error",
    });
  }
});
