import type { H3Event } from "h3";
import type { User } from "../database/types";
import type { SessionFlags } from "./session";
import { Buffer } from "node:buffer";
import { UAParser } from "ua-parser-js";
import { db, tables } from "../database/db";
import { encryptString } from "./encryption";
import { createSession, generateSessionToken } from "./session";
import { generateRandomRecoveryCode } from "./utils";

interface AuthenticateOauthUserOptions {
  providerName: "google" | "github";
  providerUserEmail: string;
  providerUsername: string;
  providerUserId: string;
  providerAvatar: string;
}

export async function authenticateOauthUser(options: AuthenticateOauthUserOptions, event: H3Event) {
  const existingUser = await db.query.user.findFirst({
    where: {
      email: options.providerUserEmail,
    },
  });

  if (existingUser) {
    const existingOauthAccount = await db.query.oauth_account.findFirst({
      where: {
        provider_user_id: options.providerUserId,
        provider: options.providerName,
      },
    });
    if (!existingOauthAccount) {
      await createOauthAccount(options, existingUser.id);
    }
    const sessionFlags: SessionFlags = {
      twoFactorVerified: false,
    };

    const sessionToken = generateSessionToken();
    const { browser, device, ipAdress, location, os } = await createSessionMetadata(event);
    const session = await createSession(
      sessionToken,
      existingUser.id,
      sessionFlags,
      browser,
      device,
      os,
      location,
      ipAdress,
    );

    const passkeys = await db.query.passkeys.findMany({
      where: {
        user_id: existingUser.id,
      },
    });

    const totp = await db.query.totp_credential.findFirst({
      where: {
        user_id: existingUser.id,
      },
    });

    const registeredPasskey = passkeys.length > 0;

    await setUserSession(
      event,
      {
        user: {
          id: existingUser.id,
          email: existingUser.email,
          username: existingUser.username,
          emailVerified: existingUser.email_verified,
          avatar: existingUser.profile_picture_url ?? "",
          registeredTOTP: !!totp,
          registeredPasskey,
          registered2FA: existingUser.registered_2fa,
          twoFactorVerified: false,
        },
        sessionToken,
      },
      {
        maxAge: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
      },
    );
  } else {
    const user = await createUser(options);
    await createOauthAccount(options, user.id);

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
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          emailVerified: user.email_verified,
          avatar: user.profile_picture_url ?? "",
          registeredTOTP: false,
          registeredPasskey: false,
          registered2FA: false,
          twoFactorVerified: false,
        },
        sessionToken,
      },
      {
        maxAge: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
      },
    );
  }
}

export async function createOauthAccount(options: AuthenticateOauthUserOptions, userId: string) {
  await db.insert(tables.oauth_account).values({
    provider: options.providerName,
    provider_user_id: options.providerUserId,
    user_id: userId,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

export async function createUser(options: AuthenticateOauthUserOptions): Promise<User> {
  const recoveryCode = generateRandomRecoveryCode();
  const encryptedRecoveryCode = encryptString(recoveryCode);
  const serializedRecoveryCode = Buffer.from(encryptedRecoveryCode).toString("base64");

  const [newUser] = await db
    .insert(tables.user)
    .values({
      email: options.providerUserEmail,
      recovery_code: serializedRecoveryCode,
      username: options.providerUsername,
      email_verified: true,
      profile_picture_url: options.providerAvatar,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning();

  if (!newUser) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to create user",
    });
  }

  return {
    ...newUser,
    recovery_code: newUser.recovery_code ?? serializedRecoveryCode,
  };
}

export async function createSessionMetadata(event: H3Event): Promise<{
  location: string;
  browser: string;
  device: string;
  os: string;
  ipAdress: string;
}> {
  try {
    const headers = getRequestHeaders(event);
    const localIp = headers["x-forwarded-for"] || event.context.clientAddress || "";
    const userAgent = headers["user-agent"] || "";

    const { browser, device, os } = UAParser(userAgent);

    let location = "Unknown";

    let ipData: any = null;

    if (localIp === "127.0.0.1" || localIp === "::1") {
      location = "Localhost";
    } else {
      const res = await fetch(`http://ip-api.com/json/${localIp}`);
      ipData = await res.json();
      location = `${ipData.city || "Unknown"}, ${ipData.country || "Unknown"}`;
    }

    return {
      location,
      browser: `${browser.name || "Unknown Browser"}`,
      device: device.vendor || "Unknown Device",
      os: `${os.name || "Unknown OS"}`,
      ipAdress: localIp,
    };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      statusMessage: `${errorMessage}!`,
    });
  }
}
