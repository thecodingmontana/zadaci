<script setup lang="ts">
import { AlertTriangle, ArrowRight, Loader2, Mail } from "@lucide/vue";
import { useForm } from "vee-validate";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { toast } from "~/lib/toast";
import { cn } from "~/lib/utils";
import { sendUniqueCodeSchema } from "~/types";

const props = defineProps<{
  apiUrl: string;
  onResetForm: (params: { mail: string; codeSent: boolean }) => void;
}>();

const isSendingCode = ref(false);

const sendUniqueCodeForm = useForm({
  validationSchema: sendUniqueCodeSchema,
});

const onSendUniqueCode = sendUniqueCodeForm.handleSubmit(async (values) => {
  try {
    isSendingCode.value = true;

    const res: { message: string } = await $fetch(props.apiUrl, {
      method: "POST",
      body: {
        email: values.email,
      },
    });

    toast.success(res.message ?? "Verification code sent", {
      desc: "Check your inbox for the code",
      position: "top-center",
      action: {
        label: "Continue",
        icon: ArrowRight,
      },
    });

    props.onResetForm({
      mail: values.email,
      codeSent: true,
    });
  } catch (error: any) {
    const errorMessage = error?.response ? error.response._data?.statusMessage : error?.message;

    toast.error(errorMessage ?? "Couldn't send the code, please try again.", {
      desc: "Something went wrong, please try again",
      position: "top-center",
      action: {
        label: "Retry",
        icon: AlertTriangle,
        onClick: onSendUniqueCode,
      },
    });
  } finally {
    isSendingCode.value = false;
  }
});
</script>

<template>
  <form class="mt-5 space-y-4" @submit.prevent="onSendUniqueCode">
    <FormField v-slot="{ componentField }" name="email">
      <FormItem class="space-y-1">
        <FormLabel class="flex items-center gap-1.5 text-sm font-medium">
          <Mail class="size-4 text-black/50 dark:text-white/50" />
          Email
        </FormLabel>
        <FormControl>
          <div
            :class="
              cn('rounded-md border', sendUniqueCodeForm.errors.value.email && 'border-red-300')
            "
          >
            <input
              type="text"
              placeholder="name@example.com"
              v-bind="componentField"
              :disabled="isSendingCode"
              class="block h-11.5 w-full rounded-md border-0 bg-transparent px-3 py-2 text-sm focus:bg-none focus:outline-none active:bg-transparent"
            />
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
        Boolean(
          !sendUniqueCodeForm.controlledValues.value.email ||
          sendUniqueCodeForm.errors.value.email ||
          isSendingCode,
        )
      "
      :class="
        cn(
          'flex w-full items-center justify-center gap-1.5 rounded px-5 py-2 text-sm font-medium whitespace-nowrap text-white transition-all',
          {
            'cursor-pointer bg-brand focus:bg-brand-secondary':
              sendUniqueCodeForm.controlledValues.value.email &&
              !sendUniqueCodeForm.errors.value.email &&
              !isSendingCode,
            'cursor-not-allowed bg-[#9e8cce]':
              !sendUniqueCodeForm.controlledValues.value.email ||
              sendUniqueCodeForm.errors.value.email ||
              isSendingCode,
          },
        )
      "
    >
      <Loader2 v-if="isSendingCode" class="size-4 animate-spin" />
      <template v-else>
        Continue
        <ArrowRight class="size-4" />
      </template>
    </button>
  </form>
</template>
