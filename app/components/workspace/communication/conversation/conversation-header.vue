<script setup lang="ts">
import type { TeammatesWithProfile } from "~/types";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Skeleton } from "~/components/ui/skeleton";

defineProps<{
  member: TeammatesWithProfile | null;
  status: string;
}>();

const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const statusStyles: Record<string, string> = {
  available: "bg-green-500",
  busy: "bg-red-500",
  away: "bg-yellow-500",
  dnd: "bg-red-500",
  offline: "bg-gray-400",
};

const statusLabels: Record<string, string> = {
  available: "Online",
  busy: "Busy",
  away: "Away",
  dnd: "Do Not Disturb",
  offline: "Offline",
};
</script>

<template>
  <header class="flex items-center justify-between border-b px-3 py-2.5">
    <div v-if="member" class="flex items-center gap-x-3">
      <div class="relative shrink-0">
        <Avatar class="h-8 w-8">
          <AvatarImage
            :src="member.user.profilePictureUrl ?? ''"
            :alt="member.user.username ?? ''"
          />
          <AvatarFallback class="text-xs">
            {{ initials(member.user.username ?? "") }}
          </AvatarFallback>
        </Avatar>
        <span
          class="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background"
          :class="statusStyles[status] ?? 'bg-gray-400'"
        />
      </div>
      <div class="min-w-0">
        <p class="text-sm font-semibold">{{ member.user.username }}</p>
        <p class="text-xs text-muted-foreground">
          {{ statusLabels[status] ?? "Offline" }}
        </p>
      </div>
    </div>
    <div v-else class="flex items-center gap-x-3">
      <Skeleton class="h-8 w-8 rounded-full" />
      <div class="space-y-1">
        <Skeleton class="h-4 w-24" />
        <Skeleton class="h-3 w-16" />
      </div>
    </div>
  </header>
</template>
