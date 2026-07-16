<script setup lang="ts">
import type { WorkspaceMemberDocType } from "~/plugins/rxdb.client";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import ActionTooltip from "~/components/workspace/shared/action-tooltip.vue";

const route = useRoute();
const workspaceId = computed(() => route.params.workspaceId as string);
const db = useRxDb();

const members = ref<WorkspaceMemberDocType[]>([]);

watch(
  () => db?.workspace_members,
  (col) => {
    if (!col) return;
    const sub = col.find({ selector: { workspace_id: workspaceId.value } }).$.subscribe((docs) => {
      members.value = docs;
    });
    onUnmounted(() => sub.unsubscribe());
  },
  { immediate: true },
);

const extraMembersCount = computed(() => Math.max(0, members.value.length - 3));
const visibleMembers = computed(() => members.value.slice(0, 3));

const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const hasNotifications = ref(true);
</script>

<template>
  <ActionTooltip label="Notifications" side="bottom">
    <Button variant="outline" size="icon" class="relative h-9 w-9">
      <Icon name="hugeicons:notification-02" size="18" />
      <span
        v-if="hasNotifications"
        class="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500"
      />
    </Button>
  </ActionTooltip>

  <DropdownMenu>
    <TooltipProvider>
      <DropdownMenuTrigger as-child>
        <button class="flex cursor-pointer items-center gap-1.5">
          <div class="flex -space-x-2">
            <Avatar
              v-for="member in visibleMembers"
              :key="member.id"
              class="h-8 w-8 ring-2 ring-background"
            >
              <AvatarImage :src="member.profile_picture_url ?? ''" :alt="member.username" />
              <AvatarFallback class="text-xs">
                {{ initials(member.username) }}
              </AvatarFallback>
            </Avatar>
          </div>
          <span v-if="extraMembersCount > 0" class="text-sm text-muted-foreground"
            >+{{ extraMembersCount }}</span
          >
          <Icon name="hugeicons:arrow-down-01" size="14" class="text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <Tooltip>
        <TooltipTrigger as-child> </TooltipTrigger>
        <TooltipContent side="bottom">
          <p class="text-sm font-semibold">View members</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <DropdownMenuContent align="end" class="w-56">
      <DropdownMenuLabel>Members</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem v-for="member in members" :key="member.id" class="gap-2">
        <Avatar class="h-6 w-6">
          <AvatarImage :src="member.profile_picture_url ?? ''" :alt="member.username" />
          <AvatarFallback class="text-[10px]">
            {{ initials(member.username) }}
          </AvatarFallback>
        </Avatar>
        <span class="text-sm">{{ member.username }}</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <ActionTooltip label="Add a new member" side="bottom">
    <Button size="sm" class="gap-1.5 bg-brand hover:bg-brand-secondary">
      <Icon name="hugeicons:plus-sign" size="16" />
      Add Member
    </Button>
  </ActionTooltip>
</template>
