import { eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const body = await readBody<{ version: string }>(event);

    const version = typeof body?.version === "string" ? body.version.trim() : "";
    if (!version) {
      throw createError({ statusCode: 400, statusMessage: "version is required" });
    }

    await db
      .update(tables.user)
      .set({
        whats_new_last_seen_version: version,
        updated_at: new Date(),
      })
      .where(eq(tables.user.id, session.user.id));

    return { ok: true, version };
  } catch (error: any) {
    const errorMessage = error?.statusMessage || error?.message || "Unknown error";
    throw createError({
      statusMessage: errorMessage,
      statusCode: error.statusCode || 500,
    });
  }
});
