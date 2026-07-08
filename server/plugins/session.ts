import { invalidateSession, validateSessionToken } from "../libs/session";

export default defineNitroPlugin(() => {
  sessionHooks.hook("fetch", async (session) => {
    if (session?.sessionToken) {
      const isValid = await validateSessionToken(session.sessionToken);
      if (!isValid.session) {
        throw createError({
          statusCode: 401,
          message: "Session expired",
        });
      }
    }
  });

  // Called when we call useUserSession().clear() or clearUserSession(event)
  sessionHooks.hook("clear", async (session) => {
    if (session?.sessionToken) {
      await invalidateSession(session.sessionToken);
    }
  });
});
