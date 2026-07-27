<script setup lang="ts">
import { Loader } from "@lucide/vue";
import { useForm } from "vee-validate";
import { Button } from "~/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { useRxDbSafe } from "~/composables/use-rxdb";
import { toast } from "~/lib/toast";
import { cn } from "~/lib/utils";
import { useModalStore } from "~/stores/use-modal-store";
import { editChannelSchema } from "~/types/forms/schema";

const props = defineProps<{
  channelName: string;
  channelType: "public" | "private";
}>();

const modalStore = useModalStore();

const channelId = computed(() => modalStore?.data?.channelId);

const form = useForm({
  validationSchema: editChannelSchema,
  initialValues: {
    name: "",
    type: "public",
  },
});

const nameInput = ref<HTMLInputElement | null>(null);

onMounted(() => {
  if (nameInput.value) {
    nameInput.value.value = props.channelName;
  }
  form.setFieldValue("name", props.channelName);
  form.setFieldValue("type", props.channelType);
});

const isUpdating = ref(false);

const isSubmitting = computed(() => {
  if (!form.controlledValues.value.name || form.errors.value.name || isUpdating.value) {
    return true;
  }
  return false;
});

function onClose() {
  modalStore?.setIsOpen(false);
  modalStore?.onClose();
}

const onEditChannel = form.handleSubmit(async (values) => {
  if (!channelId.value) return;
  isUpdating.value = true;

  const promise = $fetch(`/api/channels/${channelId.value}`, {
    method: "PATCH",
    body: { name: values.name, type: values.type },
  });

  toast.promise(promise, {
    loading: "Updating channel...",
    success: `#${values.name} channel updated!`,
    error: (err: any) =>
      err?.response?._data?.statusMessage ?? err?.message ?? "Couldn't update channel",
    errorDesc: "Check the details and try again",
    position: "top-center",
  });

  promise
    .then(async (res: any) => {
      if (res?.channel) {
        const db = await useRxDbSafe();
        if (db) {
          const doc = await db.channels.findOne(channelId.value!).exec();
          if (doc) {
            await doc.patch({
              name: res.channel.name,
              type: res.channel.type,
              updated_at: res.channel.updated_at,
            });
          }
        }
        onClose();
      }
    })
    .catch(() => {})
    .finally(() => {
      isUpdating.value = false;
    });
});
</script>

<template>
  <form class="space-y-4" @submit.prevent="onEditChannel">
    <FormField v-slot="{ componentField, meta }" name="name">
      <FormItem class="space-y-1">
        <FormLabel class="text-onboarding-text-300 text-sm font-medium"> Channel Name </FormLabel>
        <FormControl>
          <div
            :class="
              cn('rounded-md border', meta.touched && form.errors.value.name && 'border-red-300')
            "
          >
            <input
              ref="nameInput"
              type="text"
              placeholder="e.g design-team"
              v-bind="componentField"
              class="placeholder:text-custom-text-400 border-custom-border-200 placeholder:text-onboarding-text-400 block h-11.5 w-full rounded-md border-0 bg-transparent px-3 py-2 text-sm focus:bg-none focus:outline-none active:bg-transparent"
            />
          </div>
        </FormControl>
        <div v-if="meta.touched" class="flex items-center gap-1 px-0.5 text-xs text-red-600">
          <Icon v-if="form.errors.value.name" name="lucide:circle-alert" class="size-5" />
          <FormMessage />
        </div>
      </FormItem>
    </FormField>

    <FormField v-slot="{ value, handleChange }" name="type">
      <FormItem class="space-y-2">
        <FormLabel class="text-onboarding-text-300 text-sm font-medium"> Channel Type </FormLabel>
        <div class="flex gap-2">
          <button
            type="button"
            :class="
              cn(
                'flex flex-1 cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-all',
                value === 'public'
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-border text-muted-foreground hover:border-brand/30',
              )
            "
            @click="handleChange('public')"
          >
            <Icon name="lucide:globe" class="size-4 shrink-0" />
            <div class="text-left">
              <div class="font-medium">Public</div>
              <div class="text-xs opacity-70">All workspace members can join</div>
            </div>
          </button>
          <button
            type="button"
            :class="
              cn(
                'flex flex-1 cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-all',
                value === 'private'
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-border text-muted-foreground hover:border-brand/30',
              )
            "
            @click="handleChange('private')"
          >
            <Icon name="lucide:lock" class="size-4 shrink-0" />
            <div class="text-left">
              <div class="font-medium">Private</div>
              <div class="text-xs opacity-70">Only invited members can access</div>
            </div>
          </button>
        </div>
      </FormItem>
    </FormField>

    <div class="flex flex-col items-center gap-2 pt-1">
      <button
        type="submit"
        :disabled="isSubmitting"
        :class="
          cn(
            'flex w-full items-center justify-center gap-1.5 rounded px-5 py-2 text-sm font-medium whitespace-nowrap text-white transition-all',
            {
              'cursor-pointer bg-brand focus:bg-brand-secondary':
                form.controlledValues.value.name && !form.errors.value.name,
              'cursor-not-allowed bg-brand-secondary opacity-50':
                !form.controlledValues.value.name || form.errors.value.name || isUpdating,
            },
          )
        "
      >
        <Loader v-if="isUpdating" class="size-5 animate-spin" />
        <Icon v-else name="lucide:check" class="size-4" />
        Save Changes
      </button>
      <Button
        type="button"
        :disabled="isUpdating"
        variant="ghost"
        class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded px-5 py-2 text-sm font-medium whitespace-nowrap transition-all"
        @click="onClose"
      >
        Cancel
      </Button>
    </div>
  </form>
</template>
