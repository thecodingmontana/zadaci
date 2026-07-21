<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

defineProps<{
  name: string;
  type: "discussion" | "conversation";
  isSelfChat?: boolean;
  avatarUrl?: string | null;
}>();

function initials(name: string) {
  return (name.trim()[0] ?? "?").toUpperCase();
}
</script>

<template>
  <div class="mb-4 space-y-2 px-4">
    <div v-if="type === 'conversation' && avatarUrl" class="h-[75px] w-[75px]">
      <Avatar class="h-full w-full">
        <AvatarImage :src="avatarUrl" :alt="name" />
        <AvatarFallback class="text-2xl">{{ initials(name) }}</AvatarFallback>
      </Avatar>
    </div>
    <div
      v-else
      class="flex h-[75px] w-[75px] items-center justify-center rounded-full bg-zinc-500 dark:bg-zinc-700"
    >
      <Icon v-if="type === 'conversation'" name="lucide:user" size="48" class="text-white" />
      <Icon v-else name="lucide:hash" size="48" class="text-white" />
    </div>

    <p v-if="type === 'conversation'" class="text-xl font-bold md:text-3xl">
      {{ name }}
    </p>
    <p v-else class="text-xl font-bold md:text-3xl">Welcome to #{{ name }}</p>

    <p v-if="type === 'conversation'" class="text-sm text-zinc-600 dark:text-zinc-400">
      This is the start of your conversation with {{ isSelfChat ? "yourself" : name }}.
    </p>
    <p v-else class="text-sm text-zinc-600 dark:text-zinc-400">
      This is the start of the #{{ name }} discussion — send the first message.
    </p>
  </div>
</template>
