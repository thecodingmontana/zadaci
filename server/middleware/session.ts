import { validateSessionToken } from "../libs/session";

// Routes a half-signed-in user (2FA pending) must still reach.
const TWO_FACTOR_EXEMPT = [
  "/api/auth/signin",
  "/api/auth/signup",
  "/api/auth/user/2fa/totp/verify",
  "/api/auth/user/webauthn/authenticate",
];

/**
 * The session cookie is only a sealed token; this checks it against the DB on every API
 * call so revoked or expired sessions stop working, and 2FA is enforced server-side.
 */
export default defineEventHandler(async (event) => {
  const path = event.path.split("?")[0]!;
  // /api/_auth/session is already validated by the session plugin's fetch hook.
  if (!path.startsWith("/api/") || path.startsWith("/api/_auth/")) return;

  const session = await getUserSession(event);
  if (!session.sessionToken) return; // anonymous: each route decides

  const { session: dbSession, user } = await validateSessionToken(session.sessionToken as string);
  if (!dbSession) {
    await clearUserSession(event);
    throw createError({ statusCode: 401, statusMessage: "Session expired" });
  }
  if (
    user.registered2FA &&
    !dbSession.twoFactorVerified &&
    !TWO_FACTOR_EXEMPT.some((p) => path.startsWith(p))
  ) {
    throw createError({ statusCode: 403, statusMessage: "Two-factor verification required" });
  }
});
