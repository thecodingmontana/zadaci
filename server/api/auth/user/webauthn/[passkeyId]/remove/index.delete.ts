import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { and, eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const passkeyId = getRouterParam(event, "passkeyId");

    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized",
      });
    }

    if (!passkeyId || typeof passkeyId !== "string") {
      throw createError({
        statusCode: 400,
        statusMessage: "passkeyId is required!",
      });
    }

    // Check if passkey exists
    const existingPasskey = await db.query.passkeys.findFirst({
      where: {
        id: passkeyId,
        user_id: session.user.id,
      },
    });

    if (!existingPasskey) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid passkey data!",
      });
    }

    await db
      .delete(tables.passkeys)
      .where(and(eq(tables.passkeys.id, passkeyId), eq(tables.passkeys.user_id, session.user.id)));

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
      // check if user has a totp credential
      const totp = await db.query.totp_credential.findFirst({
        where: {
          user_id: session.user.id,
        },
      });

      if (!totp) {
        // update user details
        await db
          .update(tables.user)
          .set({
            updated_at: new Date(),
            registered_2fa: false,
          })
          .where(eq(tables.user.id, session.user.id));

        // update user session
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
            registeredPasskey: false,
          },
        });
      }
    }

    return {
      message: "You've successfully removed the passkey!",
    };
  } catch (error: any) {
    throw createError({
      message: error.message,
      statusCode: error.statusCode ? error.statusCode : 500,
    });
  }
});
