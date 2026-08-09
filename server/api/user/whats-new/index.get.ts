import { db } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);

    const user = await db.query.user.findFirst({
      where: { id: session.user.id },
      columns: { whats_new_last_seen_version: true },
    });

    return {
      lastSeenVersion: user?.whats_new_last_seen_version ?? null,
    };
  } catch (error: any) {
    const errorMessage = error?.statusMessage || error?.message || "Unknown error";
    throw createError({
      statusMessage: errorMessage,
      statusCode: error.statusCode || 500,
    });
  }
});
