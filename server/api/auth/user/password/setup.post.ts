import { eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);

    const { password } = await readBody(event);

    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized",
      });
    }

    if (typeof password !== "string" || !password) {
      throw createError({
        statusMessage: "Invalid password!",
        statusCode: 400,
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

    // Hash password
    const hashedPassword = await hashPassword(password);

    await db
      .update(tables.user)
      .set({
        password: hashedPassword,
      })
      .where(eq(tables.user.id, user.id));

    return {
      message: "You've successfully setup your password",
    };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      statusMessage: `${errorMessage}!`,
    });
  }
});
