<script setup lang="ts">
import { Loader } from "@lucide/vue";
import { useQueryClient } from "@tanstack/vue-query";
import { workspaceInvitesKey } from "~/composables/use-workspace-invites";
import { toast } from "~/lib/toast";
import InviteEmailTags from "../members/invite-email-tags.vue";

const props = defineProps<{
  onClose: () => void;
  workspaceId: string;
}>();

const queryClient = useQueryClient();

const emailTags = ref<string[]>([]);
const isSendingInvites = ref(false);

const onSetEmailTags = (tags: string[]) => {
  emailTags.value = tags;
};

function onSendInvite() {
  const teammates = emailTags.value.map((email) => ({
    role: "member",
    email,
  }));
  isSendingInvites.value = true;
  const promise = $fetch(`/api/workspace/${props.workspaceId}/teammates/team-invite/send`, {
    method: "POST",
    body: { teammates },
  });
  toast.promise(promise, {
    loading: "Sending invites...",
    success: (res: any) => res.message,
    error: (err: any) =>
      err.response?._data?.statusMessage ?? err.message ?? "Failed to send invites",
    position: "top-center",
  });
  promise
    .then(() => {
      queryClient.invalidateQueries({ queryKey: workspaceInvitesKey(props.workspaceId) });
      props.onClose();
    })
    .catch(() => {})
    .finally(() => {
      isSendingInvites.value = false;
    });
}
</script>

<template>
  <div className="space-y-3">
    <div class="grid gap-2">
      <p class="text-center text-sm text-muted-foreground">
        New members will have <strong>member</strong> role permissions in the workspace, but you can
        change this later in the <strong>members</strong> page.
      </p>
      <InviteEmailTags
        :email-tags="emailTags"
        :is-sending-invites="isSendingInvites"
        :set-email-tags="onSetEmailTags"
      />
    </div>
    <div class="grid gap-2">
      <Button
        :disabled="isSendingInvites || emailTags.length <= 0"
        class="flex w-full gap-2 bg-brand hover:bg-brand-secondary dark:bg-primary dark:hover:bg-zinc-300"
        @click="onSendInvite"
      >
        <Loader v-if="isSendingInvites" class="size-5 animate-spin" />
        <Icon v-else name="solar:mailbox-outline" class-name="size-5" />
        Send invite
      </Button>
      <Button
        type="button"
        :disabled="isSendingInvites"
        variant="ghost"
        class="flex w-full items-center justify-center gap-1.5 rounded px-5 py-2 text-sm font-medium whitespace-nowrap transition-all"
        @click="props?.onClose"
      >
        Cancel
      </Button>
    </div>
  </div>
</template>
