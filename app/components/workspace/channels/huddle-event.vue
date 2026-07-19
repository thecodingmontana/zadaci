<script setup lang="ts">
import type { SystemEvent } from "~/types/chat";
import { dummyMembers } from "~/lib/dummy-data/channel";

const props = defineProps<{ event: SystemEvent }>();
const participants = computed(() =>
  props.event.participantIds.map((id) => dummyMembers.find((m) => m.id === id)!),
);
const names = computed(() => participants.value.map((p) => p.name).join(", "));
</script>

<template>
  <div class="flex items-center gap-2 py-2 text-sm text-muted-foreground">
    <Icon name="lucide:phone" size="14" class="text-green-500" />
    <span class="font-medium text-foreground">Huddle ended</span>
    <div class="flex -space-x-1.5">
      <Avatar v-for="p in participants" :key="p.id" class="h-5 w-5 border">
        <AvatarImage :src="p.avatar" />
        <AvatarFallback>{{ p.name[0] }}</AvatarFallback>
      </Avatar>
    </div>
    <span>{{ names }} were in the huddle for {{ event.duration }}</span>
  </div>
</template>
