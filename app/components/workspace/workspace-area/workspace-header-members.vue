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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import ActionTooltip from "~/components/workspace/shared/action-tooltip.vue";

interface Member {
  name: string;
  avatar: string;
}

const members = reactive<Member[]>([
  { name: "Albert Flores", avatar: "https://i.pravatar.cc/150?img=12" },
  { name: "Arlene McCoy", avatar: "https://i.pravatar.cc/150?img=32" },
  { name: "Jane Cooper", avatar: "https://i.pravatar.cc/150?img=45" },
]);

const extraMembersCount = 10;
const visibleMembers = computed(() => members.slice(0, 3));

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
              :key="member.name"
              class="h-8 w-8 ring-2 ring-background"
            >
              <AvatarImage :src="member.avatar" :alt="member.name" />
              <AvatarFallback class="text-xs">
                {{ initials(member.name) }}
              </AvatarFallback>
            </Avatar>
          </div>
          <span class="text-sm text-muted-foreground">+{{ extraMembersCount }}</span>
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
      <DropdownMenuItem v-for="member in members" :key="member.name" class="gap-2">
        <Avatar class="h-6 w-6">
          <AvatarImage :src="member.avatar" :alt="member.name" />
          <AvatarFallback class="text-[10px]">
            {{ initials(member.name) }}
          </AvatarFallback>
        </Avatar>
        <span class="text-sm">{{ member.name }}</span>
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
