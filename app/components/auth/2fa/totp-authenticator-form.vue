<script setup lang="ts">
import { Loader } from "@lucide/vue";
import { useForm } from "vee-validate";
import { Button } from "~/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { PinInput, PinInputGroup, PinInputSlot } from "~/components/ui/pin-input";
import { toast } from "~/lib/toast";
import { twoFactorSetupSchema } from "~/types";

const props = defineProps<{
  onClose: () => void;
}>();

const { fetch: fetchUserSession } = useUserSession();
const isTwoFactorSetup = ref(false);

const form = useForm({
  validationSchema: twoFactorSetupSchema,
});

const onSubmit = form.handleSubmit((values) => {
  isTwoFactorSetup.value = true;
  const promise = $fetch("/api/auth/user/2fa/totp/verify", {
    method: "POST",
    body: { code: values.code.join("") },
  });
  toast.promise(promise, {
    loading: "Verifying code...",
    success: (res: any) => res.message ?? "Two-factor authentication verified",
    error: (err: any) =>
      err?.response?._data?.statusMessage ??
      err?.message ??
      "Verification failed, please try again.",
    desc: "Redirecting you to onboarding",
    errorDesc: "Double-check the code and try again",
    position: "top-center",
  });
  promise
    .then(async () => {
      onCancel();
      await fetchUserSession();
      return navigateTo("/workspace/onboarding");
    })
    .catch(() => {})
    .finally(() => {
      isTwoFactorSetup.value = false;
    });
});

function onCancel() {
  form.resetForm();
  props.onClose();
}
</script>

<template>
  <form class="space-y-2" @submit="onSubmit">
    <div>
      <FormField v-slot="{ componentField, value }" name="code">
        <FormItem>
          <div class="space-y-2">
            <FormLabel class="flex items-center justify-center gap-1.5 text-base">
              <Icon name="lucide:shield-check" class="size-4 text-black/50 dark:text-white/50" />
              Enter the generated code for verification
            </FormLabel>
            <FormControl>
              <PinInput
                id="pin-input"
                :model-value="value"
                placeholder="○"
                class="flex items-center justify-center gap-2"
                otp
                type="text"
                :name="componentField.name"
                @update:model-value="
                  (arrStr) => {
                    form.setFieldValue('code', arrStr.filter(Boolean));
                  }
                "
              >
                <PinInputGroup>
                  <PinInputSlot v-for="(id, index) in 6" :key="id" :index="index" />
                </PinInputGroup>
              </PinInput>
            </FormControl>
            <div class="flex items-center justify-center gap-1 px-0.5 text-xs text-red-600">
              <Icon v-if="form.errors.value.code" name="lucide:circle-alert" class="size-3.5" />
              <FormMessage />
            </div>
          </div>
        </FormItem>
      </FormField>
    </div>
    <div class="space-y-1.5">
      <Button
        :disabled="isTwoFactorSetup"
        type="submit"
        class="w-full cursor-pointer gap-2 bg-brand hover:bg-brand-secondary"
      >
        <Loader v-if="isTwoFactorSetup" class="size-5 animate-spin" />
        <Icon v-else name="lucide:key-round" class="size-5" />
        Authenticate
      </Button>
      <Button
        type="button"
        class="w-full cursor-pointer gap-2"
        variant="outline"
        :disabled="isTwoFactorSetup"
        @click="onCancel"
      >
        <Icon name="lucide:x" class="size-4" />
        Cancel
      </Button>
    </div>
  </form>
</template>
:w
