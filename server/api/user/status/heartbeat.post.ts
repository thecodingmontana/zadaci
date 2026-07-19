import { eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const { status } = await readBody(event);

    const existing = await db.query.user_status.findFirst({
      where: { user_id: session.user.id },
    });

    if (existing) {
      const updateData: Record<string, any> = { updated_at: new Date() };
      if (status) {
        const validStatuses = ["available", "busy", "away", "dnd", "offline"];
        if (validStatuses.includes(status)) {
          updateData.status = status;
        }
      }
      await db
        .update(tables.user_status)
        .set(updateData)
        .where(eq(tables.user_status.user_id, session.user.id));
    } else {
      await db.insert(tables.user_status).values({
        user_id: session.user.id,
        status: status || "available",
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    return { ok: true };
  } catch (error: any) {
    const errorMessage = error?.statusMessage || error?.message || "Unknown error";
    throw createError({
      statusMessage: errorMessage,
      statusCode: error.statusCode || 500,
    });
  }
});
