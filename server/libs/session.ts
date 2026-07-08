import type { User } from "~~/shared/types";
import type { Session as DBSession } from "../database/types";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from "@oslojs/encoding";
import { eq, sql } from "drizzle-orm";
import { db, tables } from "../database/db";

export interface SessionFlags {
  twoFactorVerified: boolean;
}

export interface Session extends SessionFlags {
  id: string;
  expiresAt: Date;
  userId: string;
}

type SessionValidationResult = { session: Session; user: User } | { session: null; user: null };

export async function validateSessionToken(token: string): Promise<SessionValidationResult> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));

  const result = await db
    .select({
      sessionId: tables.session.id,
      userId: tables.session.user_id,
      expiresAt: tables.session.expires_at,
      twoFactorVerified: tables.session.two_factor_verified,
      userEmail: tables.user.email,
      username: tables.user.username,
      emailVerified: tables.user.email_verified,
      profilePictureUrl: tables.user.profile_picture_url,
      hasTOTP: sql<boolean>`exists (
        select 1 from ${tables.totp_credential}
        where ${tables.totp_credential.user_id} = ${tables.session.user_id}
      )`,
      hasPasskey: sql<boolean>`exists (
        select 1 from ${tables.passkeys}
        where ${tables.passkeys.user_id} = ${tables.session.user_id}
      )`,
    })
    .from(tables.session)
    .innerJoin(tables.user, eq(tables.session.user_id, tables.user.id))
    .where(eq(tables.session.id, sessionId))
    .limit(1);

  const row = result[0];
  if (row === undefined) {
    return { session: null, user: null };
  }

  const session: Session = {
    id: row.sessionId,
    userId: row.userId,
    expiresAt: row.expiresAt,
    twoFactorVerified: row.twoFactorVerified,
  };

  const registeredTOTP = Boolean(row.hasTOTP);
  const registeredPasskey = Boolean(row.hasPasskey);

  const user: User = {
    id: row.userId,
    email: row.userEmail,
    username: row.username,
    emailVerified: row.emailVerified,
    registeredTOTP,
    registeredPasskey,
    registered2FA: registeredTOTP || registeredPasskey,
    avatar: row.profilePictureUrl ?? "",
    twoFactorVerified: row.twoFactorVerified,
  };

  if (Date.now() >= session.expiresAt.getTime()) {
    await db.delete(tables.session).where(eq(tables.session.id, sessionId));
    return { session: null, user: null };
  }

  if (Date.now() >= session.expiresAt.getTime() - 1000 * 60 * 60 * 24 * 15) {
    session.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await db
      .update(tables.session)
      .set({ expires_at: session.expiresAt })
      .where(eq(tables.session.id, sessionId));
  }

  return { session, user };
}

export async function invalidateSession(sessionToken: string): Promise<void> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(sessionToken)));
  await db.delete(tables.session).where(eq(tables.session.id, sessionId));
}

export async function invalidateUserSessions(userId: string): Promise<void> {
  await db.delete(tables.session).where(eq(tables.session.user_id, userId));
}

export async function getUserSessions(userId: string): Promise<DBSession[]> {
  const sessions = await db.select().from(tables.session).where(eq(tables.session.user_id, userId));
  return sessions;
}

export function generateSessionToken(): string {
  const tokenBytes = new Uint8Array(20);
  crypto.getRandomValues(tokenBytes);
  return encodeBase32LowerCaseNoPadding(tokenBytes);
}

export async function createSession(
  token: string,
  userId: string,
  flags: SessionFlags,
  browser: string,
  device: string,
  os: string,
  location: string,
  ipAddress: string,
): Promise<Session> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const session: Session = {
    id: sessionId,
    userId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    twoFactorVerified: flags.twoFactorVerified,
  };

  await db.insert(tables.session).values({
    id: session.id,
    user_id: session.userId,
    expires_at: session.expiresAt,
    two_factor_verified: session.twoFactorVerified,
    browser,
    device,
    os,
    location,
    ip_address: ipAddress,
  });

  return session;
}

export async function setSessionAs2FAVerified(sessionId: string): Promise<void> {
  await db
    .update(tables.session)
    .set({ two_factor_verified: true })
    .where(eq(tables.session.id, sessionId));
}
