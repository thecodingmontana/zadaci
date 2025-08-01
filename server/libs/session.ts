import { sha256 } from '@oslojs/crypto/sha2'
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from '@oslojs/encoding'
import { eq } from 'drizzle-orm'
import type { Session as DBSession } from './../database/schema'
import { tables, useDrizzle } from '~/server/utils/drizzle'
import type { User } from '~/types'

export async function validateSessionToken(
  token: string,
): Promise<SessionValidationResult> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)))

  const result = await useDrizzle()
    .select({
      sessionId: tables.sessionTable.id,
      userId: tables.sessionTable.user_id,
      expiresAt: tables.sessionTable.expires_at,
      twoFactorVerified: tables.sessionTable.two_factor_verified,
      userEmail: tables.userTable.email,
      username: tables.userTable.username,
      emailVerified: tables.userTable.email_verified,
      hasTOTP: tables.totpCredential.id,
      hasPasskey: tables.passkeysTable.id,
      profilePictureUrl: tables.userTable.profile_picture_url,
    })
    .from(tables.sessionTable)
    .innerJoin(
      tables.userTable,
      eq(tables.sessionTable.user_id, tables.userTable.id),
    )
    .leftJoin(
      tables.totpCredential,
      eq(tables.sessionTable.user_id, tables.totpCredential.user_id),
    )
    .leftJoin(
      tables.passkeysTable,
      eq(tables.userTable.id, tables.passkeysTable.user_id),
    )
    .where(eq(tables.sessionTable.id, sessionId))
    .limit(1)

  if (result.length === 0) {
    return { session: null, user: null }
  }

  const row = result[0]
  const session: Session = {
    id: row.sessionId,
    userId: row.userId,
    expiresAt: row.expiresAt,
    twoFactorVerified: row.twoFactorVerified,
  }
  const user: User = {
    id: row.userId,
    email: row.userEmail,
    username: row.username,
    emailVerified: row.emailVerified,
    registeredTOTP: Boolean(row.hasTOTP),
    registeredPasskey: Boolean(row.hasPasskey),
    registered2FA: false,
    avatar: row.profilePictureUrl!,
    twoFactorVerified: false,
  }

  user.registered2FA
    = user.registeredPasskey || user.registeredTOTP

  if (Date.now() >= session.expiresAt.getTime()) {
    await useDrizzle()
      .delete(tables.sessionTable)
      .where(eq(tables.sessionTable.id, sessionId))
    return { session: null, user: null }
  }

  if (Date.now() >= session.expiresAt.getTime() - 1000 * 60 * 60 * 24 * 15) {
    session.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
    await useDrizzle()
      .update(tables.sessionTable)
      .set({ expires_at: session.expiresAt })
      .where(eq(tables.sessionTable.id, sessionId))
  }

  return { session, user }
}

export async function invalidateSession(sessionToken: string): Promise<void> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(sessionToken)))
  await useDrizzle()
    .delete(tables.sessionTable)
    .where(eq(tables.sessionTable.id, sessionId))
}

export async function invalidateUserSessions(userId: string): Promise<void> {
  await useDrizzle()
    .delete(tables.sessionTable)
    .where(eq(tables.sessionTable.user_id, userId))
}

export async function getUserSessions(userId: string): Promise<DBSession[]> {
  const sessions = await useDrizzle().query.sessionTable.findMany({
    where: table => eq(table.user_id, userId),
  })
  return sessions
}

export function generateSessionToken(): string {
  const tokenBytes = new Uint8Array(20)
  crypto.getRandomValues(tokenBytes)
  const token = encodeBase32LowerCaseNoPadding(tokenBytes)
  return token
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
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)))
  const session: Session = {
    id: sessionId,
    userId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    twoFactorVerified: flags.twoFactorVerified,
  }

  await useDrizzle()
    .insert(tables.sessionTable)
    .values({
      id: session.id,
      user_id: session.userId,
      expires_at: session.expiresAt,
      two_factor_verified: session.twoFactorVerified,
      browser,
      device,
      os,
      location,
      ip_address: ipAddress,
    })
    .returning()
  return session
}

export async function setSessionAs2FAVerified(
  sessionId: string,
): Promise<void> {
  await useDrizzle()
    .update(tables.sessionTable)
    .set({ two_factor_verified: true })
    .where(eq(tables.sessionTable.id, sessionId))
}

export interface SessionFlags {
  twoFactorVerified: boolean
}

export interface Session extends SessionFlags {
  id: string
  expiresAt: Date
  userId: string
}

type SessionValidationResult =
  | { session: Session, user: User }
  | { session: null, user: null }
