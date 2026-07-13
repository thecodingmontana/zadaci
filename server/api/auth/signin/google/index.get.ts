import type { H3Event } from "h3";
import { authenticateOauthUser } from "~~/server/libs/auth-helpers";

export default defineOAuthGoogleEventHandler({
  config: {},
  async onSuccess(event: H3Event, { user }: any) {
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
    const signinPath: string = "/auth/signin";
    return sendRedirect(event, signinPath);
  },
});
