import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { deleteUserTOTPKey } from "~~/server/libs/totp";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);

    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized",
      });
    }

    await deleteUserTOTPKey(session.user.id);

    const passkeys = await db.query.passkeys.findMany({
      where: {
        user_id: session.user.id,
      },
    });

    const user = await db.query.user.findFirst({
      where: {
        id: session.user.id,
      },
    });

    if (!user) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid user data!",
      });
    }

    if (passkeys.length <= 0 && user.registered_2fa) {
      await db
        .update(tables.user)
        .set({
          updated_at: new Date(),
          registered_2fa: false,
        })
        .where(eq(tables.user.id, session.user.id));

      if (session?.sessionToken) {
        const sessionId = encodeHexLowerCase(
          sha256(new TextEncoder().encode(session.sessionToken)),
        );
        await db
          .update(tables.session)
          .set({ two_factor_verified: false })
          .where(eq(tables.session.id, sessionId));
      }

      await setUserSession(event, {
        user: {
          ...session.user,
          twoFactorVerified: false,
          registered2FA: false,
          registeredTOTP: false,
        },
      });
    } else {
      await setUserSession(event, {
        user: {
          ...session.user,
          registeredTOTP: false,
        },
      });
    }

    return {
      message: "You've successfully disconnected your TOTP setup!",
    };
  } catch (error: any) {
    const errorMessage = error ? error.statusMessage : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      statusMessage: `${errorMessage}!`,
    });
  }
});
