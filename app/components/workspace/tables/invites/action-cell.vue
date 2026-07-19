<script setup lang="ts">
import type { Row } from "@tanstack/vue-table";
import type { WorkspaceInvite } from "~/types";
import { EllipsisIcon } from "@lucide/vue";
import { useQueryClient } from "@tanstack/vue-query";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { toast } from "~/lib/toast";

const props = defineProps<{ row: Row<WorkspaceInvite> }>();
const queryClient = useQueryClient();
const isBusy = ref(false);

function onResend() {
  const original = props.row.original;
  isBusy.value = true;
  const promise = $fetch<{ message: string }>(
    `/api/workspace/${original.workspaceId}/teammates/team-invite/resend`,
    {
      method: "PATCH",
      body: { teammates: [{ email: original.email, role: original.role }] },
    },
  );
  toast.promise(promise, {
    loading: "Resending invite...",
    success: (data) => data.message,
    error: "Failed to resend invite",
  });
  promise
    .then(() => queryClient.invalidateQueries({ queryKey: ["workspace-invites"] }))
    .catch(() => {})
    .finally(() => {
      isBusy.value = false;
    });
}

function onRemove() {
  const original = props.row.original;
  isBusy.value = true;
  const promise = $fetch<{ message: string }>(
    `/api/workspace/${original.workspaceId}/teammates/team-invite/remove`,
    {
      method: "DELETE",
      body: { emails: [original.email] },
    },
  );
  toast.promise(promise, {
    loading: "Removing invite...",
    success: (data) => data.message,
    error: "Failed to remove invite",
  });
  promise
    .then(() => queryClient.invalidateQueries({ queryKey: ["workspace-invites"] }))
    .catch(() => {})
    .finally(() => {
      isBusy.value = false;
    });
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" class="size-7 p-0" aria-label="Open menu">
        <EllipsisIcon class="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" side="bottom">
      <DropdownMenuItem class="cursor-pointer" :disabled="isBusy" @click="onResend">
        <Icon name="hugeicons:mail-send-01" class="size-4" />
        Resend
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        class="cursor-pointer text-rose-600 focus:bg-rose-600 focus:text-white"
        :disabled="isBusy"
        @click="onRemove"
      >
        <Icon name="solar:trash-bin-minimalistic-linear" class="size-4" />
        Remove invite
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
