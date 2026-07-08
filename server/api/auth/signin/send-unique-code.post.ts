import { eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { sendUniqueCodeRequest } from "~~/server/libs/emails/actions/unique-code-request";
import { createDate, generateUniqueCode, TimeSpan } from "~~/server/libs/utils";
import { isValidEmail } from "~~/server/libs/validations";

export default defineEventHandler(async (event) => {
  try {
    const { email } = await readBody(event);

    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      throw createError({
        message: "Invalid Email",
        statusCode: 400,
      });
    }

    const user = await db.query.user.findFirst({
      where: {
        email,
      },
    });

    if (!user) {
      throw createError({
        message: `Email ${email} not found!`,
        statusCode: 400,
      });
    }

    const codeExists = await db.query.unique_code.findFirst({
      where: {
        email,
      },
    });

    if (!codeExists) {
      const code = generateUniqueCode(8);

      await db.insert(tables.unique_code).values({
        email,
        code,
        expires_at: createDate(new TimeSpan(10, "m")), // 10 minutes
        created_at: new Date(),
        updated_at: new Date(),
      });

      await sendUniqueCodeRequest({
        code,
        email,
      });

      return {
        message: "Check your email for the unique code!",
      };
    }

    const code = generateUniqueCode(8);

    await db
      .update(tables.unique_code)
      .set({
        code,
        expires_at: createDate(new TimeSpan(10, "m")),
        updated_at: new Date(),
      })
      .where(eq(tables.unique_code.email, email));

    await sendUniqueCodeRequest({
      code,
      email,
    });

    return {
      message: "Check your email for the unique code!",
    };
  } catch (error: any) {
    throw createError({
      message: error.message,
      statusCode: error.statusCode ? error.statusCode : 500,
    });
  }
});
