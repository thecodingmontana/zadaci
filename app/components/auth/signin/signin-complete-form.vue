<script setup lang="ts">
import { AlertCircle, Loader } from "@lucide/vue";
import { useForm } from "vee-validate";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { toast } from "~/lib/toast";
import { cn } from "~/lib/utils";
import { signinFormSchema } from "~/types";
import ResendCodeButton from "../resend-code-button.vue";

const props = defineProps<{
  email: string;
  onResetForm: (params: { mail: string; codeSent: boolean }) => void;
}>();

const isSigningIn = ref(false);
const apiUrl = ref("/api/auth/signin/send-unique-code");
const isResendCode = ref(false);

const { fetch: refreshSession } = useUserSession();

const form = useForm({
  validationSchema: signinFormSchema,
});

function setIsResendingCode(payload: boolean) {
  isResendCode.value = payload;
}

const onSubmit = form.handleSubmit(async (values) => {
  try {
    isSigningIn.value = true;

    const res = await $fetch("/api/auth/signin", {
      method: "POST",
      body: {
        email: props.email,
        code: values.code,
      },
    });

    toast.success(res.message ?? "Signed in successfully", {
      desc: "Redirecting you to onboarding",
      position: "top-center",
      action: {
        label: "Continue",
        icon: (await import("@lucide/vue")).ArrowRight,
      },
    });

    props.onResetForm({
      mail: "",
      codeSent: false,
    });

    await refreshSession();
    return navigateTo("/workspace/onboarding");
  } catch (error: any) {
    const errorMessage = error?.response ? error.response._data?.message : error?.message;

    toast.error(errorMessage ?? "Sign in failed, please try again.", {
      desc: "Check your code and try again",
      position: "top-center",
      action: {
        label: "Retry",
        icon: (await import("@lucide/vue")).RotateCw,
        onClick: onSubmit,
      },
    });
  } finally {
    isSigningIn.value = false;
  }
});

function onClear() {
  props.onResetForm({
    mail: "",
    codeSent: false,
  });
  form.resetForm();
  const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
  const codeInput = document.querySelector('input[name="code"]') as HTMLInputElement;

  if (emailInput) {
    emailInput.value = "";
  } else if (codeInput) {
    codeInput.value = "";
  }
}
</script>

<template>
  <form class="mt-5 space-y-4" @submit.prevent="onSubmit">
    <div class="space-y-2">
      <div class="space-y-1">
        <label class="flex items-center gap-1.5 text-sm font-medium">
          <Icon name="lucide:mail" class="size-4 text-black/50 dark:text-white/50" />
          Email
        </label>
        <div
          :class="
            cn(
              'relative flex items-center rounded-md border',
              form.errors.value.code && 'border-red-300',
            )
          "
        >
          <input
            name="email"
            type="text"
            placeholder="name@example.com"
            :value="props.email"
            disabled
            class="block h-11.5 w-full rounded-md border-0 bg-transparent px-3 py-2 text-sm focus:outline-none"
          />
          <button
            type="button"
            aria-label="Clear email"
            class="absolute right-3 grid size-6 place-items-center rounded-full bg-background text-black/50 transition hover:cursor-pointer hover:text-black/80 dark:text-white/50 dark:hover:text-white/80"
            @click="onClear"
          >
            <Icon name="lucide:x-circle" class="size-5" />
          </button>
        </div>
      </div>
      <FormField v-slot="{ componentField }" name="code">
        <FormItem class="space-y-1">
          <FormLabel class="flex items-center gap-1.5 text-sm font-medium">
            <Icon name="lucide:key-round" class="size-4 text-black/50 dark:text-white/50" />
            Code
          </FormLabel>
          <FormControl>
            <div :class="cn('rounded-md border', form.errors.value.code && 'border-red-300')">
              <input
                type="text"
                autocomplete="off"
                placeholder="gets-sets-flys"
                v-bind="componentField"
                :disabled="form.isSubmitting.value || isResendCode"
                class="block h-11.5 w-full rounded-md border-0 bg-transparent px-3 py-2 text-sm focus:bg-none focus:outline-none active:bg-transparent"
              />
            </div>
          </FormControl>
          <div class="flex items-center gap-1 px-0.5 text-xs text-red-600">
            <AlertCircle v-if="form.errors.value.code" class="size-5" />
            <FormMessage />
          </div>
          <div class="flex w-full items-center justify-between pt-1">
            <p class="flex items-center gap-1 text-xs font-medium text-green-700">
              <Icon name="lucide:circle-check" class="size-3.5" />
              Paste the code sent to your email
            </p>
            <ResendCodeButton
              :email="props.email"
              :api-url="apiUrl"
              :set-is-resending-code="setIsResendingCode"
              :is-resend-code="isResendCode"
            />
          </div>
        </FormItem>
      </FormField>
    </div>
    <button
      type="submit"
      :disabled="
        Boolean(!form.controlledValues.value.code || form.errors.value.code || isSigningIn) ||
        isResendCode
      "
      :class="
        cn(
          'flex w-full items-center justify-center gap-1.5 rounded px-5 py-2 text-sm font-medium whitespace-nowrap text-white transition-all',
          {
            'cursor-pointer bg-brand focus:bg-brand-secondary':
              !form.errors.value.code && form.controlledValues.value.code,
            'cursor-not-allowed bg-brand-secondary opacity-80':
              !form.controlledValues.value.code || form.errors.value.code || isSigningIn,
          },
        )
      "
    >
      <Loader v-if="isSigningIn" class="size-5 animate-spin" />
      <Icon v-else name="lucide:arrow-right" class="size-4" />
      Continue
    </button>
  </form>
</template>
