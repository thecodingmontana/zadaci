import { sha256 } from "@oslojs/crypto/sha2";
import { decodeBase64, encodeHexLowerCase } from "@oslojs/encoding";
import { verifyTOTP } from "@oslojs/otp";
import { eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { setSessionAs2FAVerified } from "~~/server/libs/session";
import { updateUserTOTPKey } from "~~/server/libs/totp";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const { encodedKey, code } = await readBody(event);

    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized",
      });
    }

    if (typeof encodedKey !== "string" || typeof code !== "string") {
      throw createError({
        statusMessage: "Invalid or missing fields!",
        statusCode: 400,
      });
    }

    if (code === "" || encodedKey.length !== 28) {
      throw createError({
        statusMessage: "Code is required!",
        statusCode: 400,
      });
    }

    let key: Uint8Array;

    try {
      key = decodeBase64(encodedKey);
    } catch {
      throw createError({
        statusMessage: "Invalid Key!",
        statusCode: 400,
      });
    }

    if (key.byteLength !== 20) {
      throw createError({
        statusMessage: "Invalid Key!",
        statusCode: 400,
      });
    }

    if (!verifyTOTP(key, 30, 6, code)) {
      throw createError({
        statusMessage: "Invalid code!",
        statusCode: 400,
      });
    }

    await updateUserTOTPKey(session.user.id, key);

    await db
      .update(tables.user)
      .set({
        updated_at: new Date(),
        registered_2fa: true,
      })
      .where(eq(tables.user.id, session.user.id));

    // update user session
    if (session?.sessionToken) {
      const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(session.sessionToken)));
      await setSessionAs2FAVerified(sessionId);
    }

    await setUserSession(event, {
      user: {
        ...session.user,
        registeredTOTP: true,
        registered2FA: session.user.registered2FA,
        twoFactorVerified: true,
      },
    });

    return {
      message: "You've successfully setup TOTP for your account!",
    };
  } catch (error: any) {
    const errorMessage = error ? error.statusMessage : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      statusMessage: `${errorMessage}!`,
    });
  }
});
