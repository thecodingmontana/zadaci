import type { H3Event } from "h3";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, tables } from "~~/server/database/db";
import { setSessionAs2FAVerified } from "~~/server/libs/session";

interface ISuccess {
  user: {
    userName: string;
  };
  credential: {
    id: string;
    publicKey: string;
    counter: number;
    backedUp: true;
    transports: string;
  };
}

export default defineWebAuthnRegisterEventHandler({
  async storeChallenge(event: H3Event, challenge: string, attemptId: string) {
    await useStorage().setItem(`attempt:${attemptId}`, challenge);
  },
  // @ts-expect-error expect types error
  async getChallenge(event: H3Event, attemptId: string) {
    const challenge = await useStorage().getItem(`attempt:${attemptId}`);
    if (!challenge) {
      throw createError({
        statusCode: 400,
        statusMessage: "Challenge not found or expired!",
      });
    }
    await useStorage().removeItem(`attempt:${attemptId}`);
    return challenge;
  },
  async validateUser(userBody: { userName: string }, event: H3Event) {
    const session = await getUserSession(event);
    if (session.user?.email && session.user.email !== userBody.userName) {
      throw createError({ statusCode: 400, message: "Email not matching curent session" });
    }
    return z
      .object({
        userName: z.string().email(),
      })
      .parse(userBody);
  },
  // @ts-expect-error expect types error
  async onSuccess(event: H3Event, { user, credential }: ISuccess) {
    const session = await requireUserSession(event);
    // update user details to registered2FA
    const [dbUser] = await db
      .update(tables.user)
      .set({
        updated_at: new Date(),
        registered_2fa: true,
      })
      .where(eq(tables.user.email, user.userName))
      .returning();

    if (!dbUser) {
      throw createError({
        statusCode: 400,
        statusMessage: "Failed to update user!",
      });
    }

    await db.insert(tables.passkeys).values({
      user_id: dbUser.id,
      id: credential.id,
      public_key: credential.publicKey,
      counter: credential.counter,
      backed_up: credential.backedUp,
      transports: credential.transports,
      created_at: new Date(),
      updated_at: new Date(),
    });
    // update user session
    if (session?.sessionToken) {
      const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(session.sessionToken)));
      await setSessionAs2FAVerified(sessionId);
    }
    await setUserSession(event, {
      user: {
        ...session.user,
        registeredPasskey: true,
        registered2FA: true,
        twoFactorVerified: true,
      },
    });
  },
  // @ts-expect-error expect types error
  async excludeCredentials(event: H3Event, userName: string) {
    return db
      .select({
        id: tables.passkeys.id,
        transports: tables.passkeys.transports,
      })
      .from(tables.user)
      .innerJoin(tables.passkeys, eq(tables.passkeys.user_id, tables.user.id))
      .where(eq(tables.user.username, userName.toLowerCase().trim()));
  },
});
