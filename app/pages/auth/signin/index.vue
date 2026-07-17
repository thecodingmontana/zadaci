<script setup lang="ts">
import OauthProviders from "~/components/auth/oauth/oauth-providers.vue";
import SigninForm from "~/components/auth/signin/signin-form.vue";
import ThemeToggle from "~/components/shared/theme-toggle.vue";
import BackgroundPattern from "~/components/svgs/background-pattern.vue";
import Zadaci from "~/components/svgs/zadaci.vue";
import { useOauthStore } from "~/stores/use-oauth-store";

definePageMeta({
  layout: "auth",
});

const oauthStore = useOauthStore();
const { loggedIn } = useUserSession();

watch(
  loggedIn,
  (isLoggedIn) => {
    if (isLoggedIn) {
      navigateTo("/workspace/onboarding");
    }
  },
  {
    immediate: true,
  },
);

useSeoMeta({
  title: "Sign in",
  description: "Sign in to your Zadaci account to access your workspace, projects, and tasks.",
});

defineOgImage("Zadaci", {
  title: "Sign in",
  description: "Sign in to your Zadaci account to access your workspace, projects, and tasks.",
});

onMounted(() => {
  oauthStore.onSigninWithOauthProvider({
    isSigninWithOauth: false,
    provider: null,
  });
});
</script>

<template>
  <div class="relative flex h-screen w-full flex-col overflow-hidden">
    <div class="relative size-full overflow-hidden">
      <div class="h-screen w-full overflow-hidden">
        <div class="relative h-screen w-screen overflow-hidden">
          <div class="absolute inset-0 z-0 dark:hidden">
            <BackgroundPattern class="size-full" />
          </div>
          <div
            class="relative z-10 flex h-[80vh] w-screen flex-col overflow-hidden overflow-y-auto"
          >
            <div class="flex justify-end p-5">
              <ThemeToggle />
            </div>
            <div
              class="container mx-auto flex h-[calc(100vh-60px)] max-w-lg grow flex-col justify-center px-10 transition-all lg:max-w-md lg:px-5"
            >
              <div class="relative flex flex-col space-y-3">
                <div class="flex flex-col items-center gap-y-4">
                  <NuxtLink to="/" class="flex items-center gap-x-2.5">
                    <Zadaci class="h-auto w-12" />
                    <h1 class="font-bebas-neue mt-1 text-5xl font-semibold">Zadaci</h1>
                  </NuxtLink>
                  <div class="space-y-1 text-center">
                    <h3 class="text-3xl font-bold text-brand dark:text-primary">Hello Again!</h3>
                    <p class="text-sm text-muted-foreground">Sign in to access your account.</p>
                  </div>
                </div>
                <SigninForm />
                <div class="flex items-center">
                  <hr class="w-full" />
                  <p class="mx-3 shrink-0 text-center text-sm">or</p>
                  <hr class="w-full" />
                </div>
                <OauthProviders />
                <p class="text-center text-sm">
                  Don't have an account?
                  <NuxtLink to="/auth/signup" class="cursor-pointer underline decoration-wavy"
                    >Sign up</NuxtLink
                  >.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
