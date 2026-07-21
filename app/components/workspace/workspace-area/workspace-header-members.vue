<script setup lang="ts">
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
import { Skeleton } from "~/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import ActionTooltip from "~/components/workspace/shared/action-tooltip.vue";

const route = useRoute();
const workspaceId = computed(() => route.params.workspaceId as string);
const { data: members, isLoading } = useWorkspaceMembers(workspaceId as any);

const extraMembersCount = computed(() => Math.max(0, (members.value?.length ?? 0) - 3));
const visibleMembers = computed(() => (members.value ?? []).slice(0, 3));

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
        <button class="hidden cursor-pointer items-center gap-1.5 lg:flex">
          <div v-if="!isLoading" class="flex -space-x-2">
            <Avatar
              v-for="member in visibleMembers"
              :key="member.id"
              class="h-8 w-8 ring-2 ring-background"
            >
              <AvatarImage :src="member.user.profilePictureUrl ?? ''" :alt="member.user.username" />
              <AvatarFallback class="text-xs">
                {{ initials(member.user.username) }}
              </AvatarFallback>
            </Avatar>
          </div>
          <div v-else class="flex -space-x-2">
            <Skeleton v-for="n in 3" :key="n" class="h-8 w-8 rounded-full ring-2 ring-background" />
          </div>
          <span v-if="!isLoading && extraMembersCount > 0" class="text-sm text-muted-foreground"
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
      <DropdownMenuItem v-for="member in members ?? []" :key="member.id" class="gap-2">
        <Avatar class="h-6 w-6">
          <AvatarImage :src="member.user.profilePictureUrl ?? ''" :alt="member.user.username" />
          <AvatarFallback class="text-[10px]">
            {{ initials(member.user.username) }}
          </AvatarFallback>
        </Avatar>
        <span class="text-sm">{{ member.user.username }}</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
