<script setup lang="ts">
import { Loader2 } from "@lucide/vue";
import { Button } from "~/components/ui/button";
import { toast } from "~/lib/toast";

const props = defineProps<{
  onSetIsAuthenticating: (payload: boolean) => void;
  email: string;
  isAuthenticating: boolean;
}>();

const { authenticate } = useWebAuthn({
  authenticateEndpoint: "/api/auth/user/webauthn/authenticate",
});
const { fetch: fetchUserSession } = useUserSession();

function onUsePasskeys() {
  props.onSetIsAuthenticating(true);
  const promise = (async () => {
    await authenticate(props.email);
    await fetchUserSession();
    return navigateTo("/workspace/onboarding");
  })();
  toast.promise(promise, {
    loading: "Authenticating with passkey...",
    success: "Signed in with passkey",
    error: (err: any) =>
      err?.response?._data?.statusMessage ?? err?.message ?? "Passkey authentication failed.",
    desc: "Redirecting you to onboarding",
    errorDesc: "Please try again",
    position: "top-center",
  });
  promise
    .catch(() => {})
    .finally(() => {
      props.onSetIsAuthenticating(false);
    });
}
</script>

<template>
  <Button
    :disabled="props.isAuthenticating"
    class="w-full cursor-pointer gap-2 bg-brand hover:bg-brand-secondary dark:text-white"
    @click="onUsePasskeys"
  >
    <Loader2 v-if="props.isAuthenticating" class="size-5 animate-spin" />
    <Icon v-else name="hugeicons:finger-access" class="size-5" />
    Use Passkeys
  </Button>
</template>
:w
