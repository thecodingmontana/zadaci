import { db } from "~~/server/database/db";

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
      where: {
        id: session.user.id,
      },
      columns: {
        recovery_code: true,
        id: true,
      },
    });

    if (!user) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid user!",
      });
    }

    const passkeys = await db.query.passkeys.findMany({
      where: {
        user_id: user.id,
      },
    });

    return {
      passkeyCredentials: passkeys,
    };
  } catch (error: any) {
    const errorMessage = error ? error.statusMessage : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      statusMessage: `${errorMessage}!`,
    });
  }
});
