<script setup lang="ts">
import { Loader } from "@lucide/vue";
import { useQueryClient } from "@tanstack/vue-query";
import { useForm } from "vee-validate";
import { Button } from "~/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { useRxDbSafe } from "~/composables/use-rxdb";
import { toast } from "~/lib/toast";
import { cn } from "~/lib/utils";
import { useModalStore } from "~/stores/use-modal-store";
import { useWorkspaceStore } from "~/stores/use-workspace-store";
import { createChannelSchema } from "~/types/forms/schema";

const modalStore = useModalStore();
const workspaceStore = useWorkspaceStore();
const { user: authUser } = useUserSession();
const queryClient = useQueryClient();

const workspace = computed(() => workspaceStore?.activeWorkspace);
const workspaceIdRef = computed(() => workspace.value?.id as string | undefined);
const { data: members } = useWorkspaceMembers(workspaceIdRef);

const currentMemberId = computed(() => {
  if (!members.value || !authUser.value?.id) return "";
  const m = members.value.find((m: any) => m.userId === authUser.value!.id);
  return m?.id ?? "";
});

const form = useForm({
  validationSchema: createChannelSchema,
  initialValues: {
    name: "",
    type: "public",
  },
});

const isCreating = ref(false);

const isSubmitting = computed(() => {
  if (!form.controlledValues.value.name || form.errors.value.name || isCreating.value) {
    return true;
  }
  return false;
});

function onClose() {
  modalStore.onClose();
  modalStore.setIsOpen(false);
}

function generateId(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const onCreateChannel = form.handleSubmit(async (values) => {
  if (!workspace.value?.id || !currentMemberId.value) return;
  isCreating.value = true;

  const promise = $fetch("/api/channels/create", {
    method: "POST",
    body: {
      workspaceId: workspace.value.id,
      name: values.name,
      type: values.type,
    },
  });

  toast.promise(promise, {
    loading: `Creating ${values.type === "public" ? "public" : "private"} channel...`,
    success: `#${values.name} channel created!`,
    error: (err: any) =>
      err?.response?._data?.statusMessage ??
      err?.message ??
      "Couldn't create channel, please try again.",
    desc:
      values.type === "public"
        ? "All workspace members have been added"
        : "Only you are in this channel for now",
    errorDesc: "Check the details and try again",
    position: "top-center",
  });

  promise
    .then(async (res: any) => {
      if (res?.channel) {
        const db = await useRxDbSafe();
        if (db) {
          const channelId = res.channel.id;
          await db.channels.insert({
            id: channelId,
            workspace_id: res.channel.workspace_id,
            name: res.channel.name,
            type: res.channel.type,
            created_by: res.channel.created_by,
            created_at: res.channel.created_at,
            updated_at: res.channel.updated_at,
            deleted_at: null,
          });

          if (res.members && res.members.length > 0) {
            for (const memberId of res.members) {
              const cmId = generateId();
              await db.channel_members.insert({
                id: cmId,
                channel_id: channelId,
                member_id: memberId,
                last_read_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          }
        }

        queryClient.invalidateQueries({ queryKey: ["channels"] });
        onClose();
      }
    })
    .catch(() => {})
    .finally(() => {
      isCreating.value = false;
    });
});
</script>

<template>
  <form class="space-y-4" @submit.prevent="onCreateChannel">
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

    <div class="flex flex-col items-center gap-2">
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
                !form.controlledValues.value.name || form.errors.value.name || isCreating,
            },
          )
        "
      >
        <Loader v-if="isCreating" class="size-5 animate-spin" />
        <Icon v-else name="lucide:plus" class="size-4" />
        Create Channel
      </button>
      <Button
        type="button"
        :disabled="isCreating"
        variant="ghost"
        class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded px-5 py-2 text-sm font-medium whitespace-nowrap transition-all"
        @click="onClose"
      >
        Cancel
      </Button>
    </div>
  </form>
</template>
