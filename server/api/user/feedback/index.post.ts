import { db, tables } from "~~/server/database/db";

const VALID_TYPES = ["bug", "feature", "feedback"];

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const body = await readBody<{ type?: string; message?: string }>(event);

    const type = typeof body?.type === "string" ? body.type.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!VALID_TYPES.includes(type)) {
      throw createError({ statusCode: 400, statusMessage: "Invalid feedback type" });
    }
    if (!message) {
      throw createError({ statusCode: 400, statusMessage: "Feedback message is required" });
    }
    if (message.length > 5000) {
      throw createError({ statusCode: 400, statusMessage: "Feedback message is too long" });
    }

    await db.insert(tables.feedback).values({
      user_id: session.user.id,
      type,
      message,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return { ok: true };
  } catch (error: any) {
    const errorMessage = error?.statusMessage || error?.message || "Unknown error";
    throw createError({
      statusMessage: errorMessage,
      statusCode: error.statusCode || 500,
    });
  }
});
