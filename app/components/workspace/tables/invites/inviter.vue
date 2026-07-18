<script setup lang="ts">
import type { Row } from "@tanstack/vue-table";
import type { WorkspaceInvite } from "~/types";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

interface Props {
  row: Row<WorkspaceInvite>;
}

const props = defineProps<Props>();
const user = props?.row.original.user;
</script>

<script lang="ts">
export default {
  inheritAttrs: false,
};
</script>

<template>
  <div :class="$attrs.class">
    <div class="flex items-center gap-2">
      <Avatar class="shrink-0 rounded-md border-muted">
        <AvatarImage :src="user.profilePictureUrl ?? undefined" />
        <AvatarFallback class="rounded-md">
          {{ user.username?.charAt(0) }}
        </AvatarFallback>
      </Avatar>
      <div class="self-start">
        <p class="text-xs font-medium capitalize sm:text-sm">
          {{ user.username }}
        </p>
        <p class="text-xs text-muted-foreground">
          {{ user.email }}
        </p>
      </div>
    </div>
  </div>
</template>
