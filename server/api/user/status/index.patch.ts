import { eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const { status } = await readBody(event);

    if (!status) {
      throw createError({ statusCode: 400, statusMessage: "Status is required!" });
    }

    const validStatuses = ["available", "busy", "away", "dnd", "offline"];
    if (!validStatuses.includes(status)) {
      throw createError({ statusCode: 400, statusMessage: `Invalid status: ${status}` });
    }

    const existing = await db.query.user_status.findFirst({
      where: { user_id: session.user.id },
    });

    if (existing) {
      const [updated] = await db
        .update(tables.user_status)
        .set({ status, updated_at: new Date() })
        .where(eq(tables.user_status.user_id, session.user.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(tables.user_status)
      .values({
        user_id: session.user.id,
        status,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();
    return created;
  } catch (error: any) {
    const errorMessage = error?.statusMessage || error?.message || "Unknown error";
    throw createError({
      statusMessage: errorMessage,
      statusCode: error.statusCode || 500,
    });
  }
});
