<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { ArrowRight, Loader2 } from "@lucide/vue";
import { useForm } from "vee-validate";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { toast } from "~/lib/toast";
import { cn } from "~/lib/utils";
import { useOauthStore } from "~/stores/use-oauth-store";
import { sendUniqueCodeSchema } from "~/types";

const props = defineProps<{
  onResetForm: (params: { mail: string; codeSent: boolean }) => void;
}>();

const oauthStore = useOauthStore();

const oauth = computed(() => {
  return oauthStore?.oauth;
});

const isSendingCode = ref(false);

const sendUniqueCodeForm = useForm({
  validationSchema: sendUniqueCodeSchema,
});

const onSendUniqueCode = sendUniqueCodeForm.handleSubmit((values) => {
  isSendingCode.value = true;
  const promise = $fetch("/api/auth/signup/send-unique-code", {
    method: "POST",
    body: { email: values.email },
  });
  toast.promise(promise, {
    loading: "Sending code...",
    success: (res: any) => res.message ?? "Verification code sent",
    error: (err: any) =>
      err?.response?._data?.message ?? err?.message ?? "Couldn't send the code, please try again.",
    desc: "Check your inbox for the code",
    errorDesc: "Check your email and try again",
    position: "top-center",
  });
  promise
    .then(() => {
      props.onResetForm({ mail: values.email, codeSent: true });
    })
    .catch(() => {})
    .finally(() => {
      isSendingCode.value = false;
    });
});
</script>

<template>
  <form class="mt-5 space-y-4" @submit.prevent="onSendUniqueCode">
    <FormField v-slot="{ componentField }" name="email">
      <FormItem class="space-y-1">
        <FormLabel class="text-sm font-medium"> Email </FormLabel>
        <FormControl>
          <div
            :class="
              cn(
                'relative rounded-md border',
                sendUniqueCodeForm.errors.value.email && 'border-red-300',
              )
            "
          >
            <input
              type="text"
              placeholder="name@example.com"
              v-bind="componentField"
              :disabled="
                isSendingCode || sendUniqueCodeForm.isSubmitting.value || oauth.isSigninWithOauth
              "
              class="peer block h-11.5 w-full rounded-md border-0 bg-transparent px-3 py-2 ps-9 text-sm focus:bg-none focus:outline-none active:bg-transparent"
            />
            <div
              className="pointer-events-none absolute inset-y-0 inset-s-0 flex items-center justify-center ps-3 text-muted-foreground/80 peer-disabled:opacity-50"
            >
              <Icon name="hugeicons:mail-at-sign-02" aria-hidden="true" size="18" />
            </div>
          </div>
        </FormControl>
        <div class="flex items-center gap-1 px-0.5 text-xs text-red-600">
          <Icon
            v-if="sendUniqueCodeForm.errors.value.email"
            name="lucide:circle-alert"
            class="size-5"
          />
          <FormMessage />
        </div>
      </FormItem>
    </FormField>
    <button
      type="submit"
      :disabled="
        !!(
          !sendUniqueCodeForm.controlledValues.value.email ||
          sendUniqueCodeForm.errors.value.email ||
          isSendingCode ||
          oauth.isSigninWithOauth
        )
      "
      :class="
        cn(
          'flex w-full items-center justify-center gap-1.5 rounded px-5 py-2 text-sm font-medium whitespace-nowrap text-white transition-all',
          {
            'cursor-pointer bg-brand focus:bg-brand-secondary':
              sendUniqueCodeForm.controlledValues.value.email &&
              !sendUniqueCodeForm.errors.value.email,
            'cursor-not-allowed bg-brand-secondary':
              !sendUniqueCodeForm.controlledValues.value.email ||
              sendUniqueCodeForm.errors.value.email ||
              isSendingCode,
          },
        )
      "
    >
      <Loader2 v-if="isSendingCode" class="size-5 animate-spin" />
      <ArrowRight v-else class="size-4" />
      Continue
    </button>
  </form>
</template>
