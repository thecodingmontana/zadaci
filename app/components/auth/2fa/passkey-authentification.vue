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

async function onUsePasskeys() {
  props.onSetIsAuthenticating(true);
  try {
    await authenticate(props.email);
    await fetchUserSession();

    toast.success("Signed in with passkey", {
      desc: "Redirecting you to onboarding",
      position: "top-center",
    });

    await navigateTo("/workspace/onboarding");
  } catch (error: any) {
    const errorMessage = error?.response ? error.response._data?.statusMessage : error?.message;
    toast.error(errorMessage ?? "Passkey authentication failed.", {
      desc: "Please try again",
      position: "top-center",
    });
  } finally {
    props.onSetIsAuthenticating(false);
  }
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
