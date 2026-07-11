<script setup lang="ts">
import type { IAuthProvider } from "~/types";
import { AlertTriangle, Loader2 } from "@lucide/vue";
import { toast } from "~/lib/toast";
import { cn } from "~/lib/utils";
import { useOauthStore } from "~/stores/use-oauth-store";

interface OauthProviderConfig {
  id: IAuthProvider;
  label: string;
  icon: string;
}

const providers: OauthProviderConfig[] = [
  { id: "google", label: "Continue with Google", icon: "devicon:google" },
];

const oauthStore = useOauthStore();
const oauth = computed(() => oauthStore.oauth);
const route = useRoute();

onMounted(() => {
  if (oauth.value.isSigninWithOauth) {
    oauthStore.onSigninWithOauthProvider({
      isSigninWithOauth: false,
      provider: null,
    });
  }

  const errorParam = route.query.error;
  if (errorParam) {
    toast.error(
      typeof errorParam === "string" ? decodeErrorMessage(errorParam) : "Sign in failed",
      {
        desc: "Please try again",
        position: "top-center",
        action: {
          label: "Dismiss",
          icon: AlertTriangle,
        },
      },
    );
  }
});

function decodeErrorMessage(code: string) {
  const messages: Record<string, string> = {
    oauth_failed: "We couldn't sign you in with that provider.",
    oauth_cancelled: "Sign in was cancelled.",
    oauth_email_conflict: "That email is already linked to a different account.",
  };
  return messages[code] ?? "Something went wrong signing you in.";
}

function onSigninWith(provider: IAuthProvider) {
  if (oauth.value.isSigninWithOauth) return;

  oauthStore.onSigninWithOauthProvider({
    isSigninWithOauth: true,
    provider,
  });
  window.location.href = `/api/auth/signin/${provider}`;
}
</script>

<template>
  <div class="grid gap-2">
    <button
      v-for="p in providers"
      :key="p.id"
      type="button"
      :disabled="oauth.isSigninWithOauth"
      :aria-busy="oauth.isSigninWithOauth && oauth.provider === p.id"
      :class="
        cn(
          'flex h-10.5 w-full items-center justify-center gap-2 rounded border px-2 text-sm font-medium duration-300 hover:border-brand/40',
          oauth.isSigninWithOauth ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
        )
      "
      @click="onSigninWith(p.id)"
    >
      <Loader2
        v-if="oauth.isSigninWithOauth && oauth.provider === p.id"
        class="size-4 animate-spin"
      />
      <Icon v-else :name="p.icon" class="size-4" />
      {{ p.label }}
    </button>
  </div>
</template>
