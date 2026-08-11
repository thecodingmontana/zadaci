import type { SessionFlags } from "~~/server/libs/session";
import { eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { createSessionMetadata } from "~~/server/libs/auth-helpers";
import { createSession, generateSessionToken } from "~~/server/libs/session";
import { isWithinExpirationDate } from "~~/server/libs/utils";
import { isValidEmail } from "~~/server/libs/validations";

export default defineEventHandler(async (event) => {
  try {
    const { email, code } = await readBody(event);

    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      throw createError({
        message: "Invalid Email",
        statusCode: 400,
      });
    }

    if (typeof code !== "string" || code.length !== 8) {
      throw createError({
        statusMessage: "Invalid unique code!",
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
        message: "Invalid user!",
        statusCode: 400,
      });
    }

    const uniqueCodeRequest = await db.query.unique_code.findFirst({
      where: {
        email,
        code,
      },
    });

    if (!uniqueCodeRequest) {
      throw createError({
        message: "Invalid unique code!",
        statusCode: 400,
      });
    }

    if (!isWithinExpirationDate(uniqueCodeRequest.expires_at)) {
      throw createError({
        message: "The unique code has expired!",
        statusCode: 498,
      });
    }

    await db.delete(tables.unique_code).where(eq(tables.unique_code.id, uniqueCodeRequest.id));

    const sessionFlags: SessionFlags = {
      twoFactorVerified: false,
    };

    const sessionToken = generateSessionToken();
    const { browser, device, ipAdress, location, os } = await createSessionMetadata(event);
    const session = await createSession(
      sessionToken,
      user.id,
      sessionFlags,
      browser,
      device,
      os,
      location,
      ipAdress,
    );

    const passkeys = await db.query.passkeys.findMany({
      where: {
        user_id: user.id,
      },
    });

    const totp = await db.query.totp_credential.findFirst({
      where: {
        user_id: user.id,
      },
    });

    const registeredPasskey = passkeys.length > 0;

    await setUserSession(
      event,
      {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          emailVerified: user.email_verified,
          avatar: user.profile_picture_url ?? "",
          registeredTOTP: !!totp,
          registeredPasskey,
          registered2FA: user.registered_2fa,
          twoFactorVerified: false,
        },
        sessionToken,
      },
      {
        maxAge: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000), // Convert milliseconds to seconds
      },
    );

    return {
      message: "Successfully signed in!",
    };
  } catch (error: any) {
    throw createError({
      message: `Failed to signin: ${error.message}`,
      statusCode: error.statusCode ? error.statusCode : 500,
    });
  }
});
