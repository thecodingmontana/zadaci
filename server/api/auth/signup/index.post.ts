import type { SessionFlags } from "~~/server/libs/session";
import type { User } from "~~/shared/types";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { db, tables } from "~~/server/database/db";
import { createSessionMetadata } from "~~/server/libs/auth-helpers";
import { encryptString } from "~~/server/libs/encryption";
import { createSession, generateSessionToken } from "~~/server/libs/session";
import {
  capitalize,
  generateRandomRecoveryCode,
  isWithinExpirationDate,
} from "~~/server/libs/utils";
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
    const existingUser = await db.query.user.findFirst({
      where: {
        email,
      },
    });
    if (existingUser) {
      throw createError({
        message: `Email ${email} already exists!`,
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
        statusMessage: "The unique code has expired!",
        statusCode: 498,
      });
    }
    await db.delete(tables.unique_code).where(eq(tables.unique_code.id, uniqueCodeRequest.id));
    const recoveryCode = generateRandomRecoveryCode();
    const encryptedRecoveryCode = encryptString(recoveryCode);
    const serializedRecoveryCode = Buffer.from(encryptedRecoveryCode).toString("base64");
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const [newUser] = await db
      .insert(tables.user)
      .values({
        email,
        recovery_code: serializedRecoveryCode,
        username: `${capitalize(firstName)} ${capitalize(lastName)}`,
        email_verified: true,
        profile_picture_url: `https://avatar.vercel.sh/${email}`,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    if (!newUser) {
      throw createError({
        message: "Failed to create user",
        statusCode: 500,
      });
    }

    const user: User = {
      id: newUser.id,
      username: newUser.username,
      email,
      emailVerified: newUser.email_verified,
      registeredTOTP: false,
      registeredPasskey: false,
      registered2FA: false,
      avatar: newUser.profile_picture_url ?? "",
      twoFactorVerified: false,
    };
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
    await setUserSession(
      event,
      {
        user,
        sessionToken,
      },
      {
        maxAge: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000), // Convert milliseconds to seconds
      },
    );
    return {
      message: "User account created successfully!",
    };
  } catch (error: any) {
    throw createError({
      message: `Failed to signup: ${error.message}`,
      statusCode: error.statusCode ? error.statusCode : 500,
    });
  }
});
