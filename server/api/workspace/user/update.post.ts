import { eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const { username, password, avatar } = await readBody(event);
    if (typeof username !== "string" || !username) {
      throw createError({
        statusMessage: "Invalid first name and last name!",
        statusCode: 400,
      });
    }
    if (typeof password !== "string") {
      throw createError({
        statusMessage: "Invalid password!",
        statusCode: 400,
      });
    }
    if (typeof avatar !== "string") {
      throw createError({
        statusMessage: "Invalid avatar!",
        statusCode: 400,
      });
    }
    const [user] = await db
      .update(tables.user)
      .set({
        username,
        profile_picture_url: avatar,
        // An empty field means "keep the current password".
        ...(password && { password: await hashPassword(password) }),
      })
      .where(eq(tables.user.id, session.user.id))
      .returning({
        id: tables.user.id,
        username: tables.user.username,
        profile_picture_url: tables.user.profile_picture_url,
      });

    if (!user) {
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to update user!",
      });
    }

    await setUserSession(event, {
      user: {
        ...session.user,
        username: user.username,
        avatar: user.profile_picture_url ?? "",
      },
    });
    return {
      user,
    };
  } catch (error: any) {
    const errorMessage = error ? error.statusMessage : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      statusMessage: `${errorMessage}!`,
    });
  }
});
