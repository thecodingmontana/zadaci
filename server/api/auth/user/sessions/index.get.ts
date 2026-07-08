import { db } from "~~/server/database/db";
import { getUserSessions } from "~~/server/libs/session";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);

    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized",
      });
    }

    // check if user exists
    const user = await db.query.user.findFirst({
      where: { id: session.user.id },
    });

    if (!user) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid user!",
      });
    }

    // retrieve user sessions
    const sessions = await getUserSessions(user.id);

    return sessions;
  } catch (error: any) {
    throw createError({
      message: error.message,
      statusCode: error.statusCode ? error.statusCode : 500,
    });
  }
});
