<script setup lang="ts">
import type { Row } from "@tanstack/vue-table";
import type { TeammatesWithProfile } from "~/types";
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
import { useModalStore } from "~/stores/use-modal-store";

const props = defineProps<{ row: Row<TeammatesWithProfile> }>();
const modalStore = useModalStore();
const queryClient = useQueryClient();
const isRemoving = ref(false);

function onChangeRole() {
  const original = props.row.original;
  modalStore?.onOpen("changeTeammateRole");
  modalStore?.setIsOpen(true);
  modalStore?.setModalData({
    teammates: [
      {
        id: original.userId,
        role: original.role,
        avatar: original.user.profilePictureUrl as string,
        username: original.user.username as string,
        email: original.user.email,
      },
    ],
  });
}

function onRemoveUser() {
  const original = props.row.original;
  isRemoving.value = true;
  const promise = $fetch<{ message: string }>(
    `/api/workspace/${original.workspaceId}/teammates/remove`,
    {
      method: "DELETE",
      body: { userIds: [original.userId], workspaceId: original.workspaceId },
    },
  );
  toast.promise(promise, {
    loading: "Removing user...",
    success: (data) => data.message,
    error: "Failed to remove teammate",
  });
  promise
    .then(() => queryClient.invalidateQueries({ queryKey: ["workspace-members"] }))
    .catch(() => {})
    .finally(() => {
      isRemoving.value = false;
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
      <DropdownMenuItem class="cursor-pointer" :disabled="isRemoving" @click="onChangeRole">
        <Icon name="hugeicons:user-edit-01" class="size-4" />
        Change role
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        class="cursor-pointer text-rose-600 focus:bg-rose-600 focus:text-white"
        :disabled="isRemoving"
        @click="onRemoveUser"
      >
        <Icon name="solar:trash-bin-minimalistic-linear" class="size-4" />
        Remove user
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
