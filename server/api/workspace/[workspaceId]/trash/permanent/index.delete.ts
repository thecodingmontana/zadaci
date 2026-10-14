import { db } from "~~/server/database/db";
import { USER_ROLE } from "~~/server/database/enums";
import { resolveTrashedItem } from "~~/server/libs/trash";

export default defineEventHandler(async (event) => {
  try {
    const { table, where, entityType } = await resolveTrashedItem(event, [
      USER_ROLE.OWNER,
      USER_ROLE.MODERATOR,
    ]);
    await db.delete(table).where(where);
    return { message: `${entityType} permanently deleted` };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || "Internal server error",
    });
  }
});
