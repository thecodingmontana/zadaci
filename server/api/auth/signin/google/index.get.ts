import type { H3Event } from "h3";
import { authenticateOauthUser } from "~~/server/libs/auth-helpers";

const STATE_COOKIE = "google_oauth_state";
const signinPath = "/auth/signin";

const googleHandler = defineOAuthGoogleEventHandler({
  config: {},
  async onSuccess(event: H3Event, { user }: any) {
    // Accounts are matched by email, so only trust addresses Google has verified.
    if (user.email_verified !== true) {
      return sendRedirect(event, signinPath);
    }
    await authenticateOauthUser(
      {
        providerName: "google",
        providerUserEmail: user.email,
        providerUserId: user.sub,
        providerUsername: user.name,
        providerAvatar: user.picture,
      },
      event,
    );

    const onboardingPath: string = "/workspace/onboarding";
    return sendRedirect(event, onboardingPath);
  },
  onError(event: H3Event, _) {
    return sendRedirect(event, signinPath);
  },
});

// nuxt-auth-utils passes `state` through without checking it, so bind it to a cookie
// here to stop login CSRF (someone logging you into their account).
export default defineEventHandler(async (event) => {
  const { code, state } = getQuery(event);
  if (!code && !state) {
    const newState = crypto.randomUUID();
    setCookie(event, STATE_COOKIE, newState, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/api/auth/signin/google",
    });
    return sendRedirect(event, `/api/auth/signin/google?state=${newState}`);
  }
  if (code) {
    const expected = getCookie(event, STATE_COOKIE);
    deleteCookie(event, STATE_COOKIE, { path: "/api/auth/signin/google" });
    if (!expected || expected !== state) {
      return sendRedirect(event, signinPath);
    }
  }
  return googleHandler(event);
});
