<script setup lang="ts">
import type { SystemEvent } from "~/types/chat";

defineProps<{ event: SystemEvent }>();
</script>

<template>
  <div class="flex items-center gap-2 py-2 text-sm text-muted-foreground">
    <Icon name="lucide:phone" size="14" class="text-green-500" />
    <span class="font-medium text-foreground">Huddle ended</span>
    <div class="flex -space-x-1.5">
      <Avatar v-for="pid in event.participantIds" :key="pid" class="h-5 w-5 border">
        <AvatarImage />
        <AvatarFallback>{{ pid.slice(0, 2) }}</AvatarFallback>
      </Avatar>
    </div>
    <span>{{ event.participantIds.length }} participants · {{ event.duration }}</span>
  </div>
</template>
