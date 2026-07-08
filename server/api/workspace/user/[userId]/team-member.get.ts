import { db } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const { userId } = event.context.params as { userId: string };
    const workspace = await db.query.workspace.findFirst({
      where: {
        members: {
          user_id: userId,
        },
      },
      with: {
        members: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });
    return workspace;
  } catch (error: any) {
    throw createError({
      message: error.message,
      statusCode: error.statusCode ? error.statusCode : 500,
    });
  }
});
