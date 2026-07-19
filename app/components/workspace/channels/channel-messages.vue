<!-- ~/components/workspace/channels/channel-messages.vue -->
<script setup lang="ts">
import type { ChatMessage, SystemEvent } from "~/types/chat";
import { motion } from "motion-v";
import { ScrollArea } from "~/components/ui/scroll-area";
import HuddleEvent from "~/components/workspace/channels/huddle-event.vue";
import MessageBubble from "~/components/workspace/channels/message-bubble.vue";
import MessagesDivider from "~/components/workspace/channels/messages-divider.vue";
import { currentUserId, dummyMembers } from "~/lib/dummy-data/channel";

const props = defineProps<{
  messages: ChatMessage[];
  systemEvents?: SystemEvent[];
  showThreadEntry?: boolean;
}>();

const emit = defineEmits<{
  react: [messageId: string, emoji: string];
  openThread: [messageId: string];
}>();

// group consecutive messages from the same author into bubble groups
const groups = computed(() => {
  const result: ChatMessage[][] = [];
  for (const message of props.messages) {
    const last = result.at(-1);
    if (last && last.at(-1)!.authorId === message.authorId) {
      last.push(message);
    } else {
      result.push([message]);
    }
  }
  return result;
});

function memberOf(id: string) {
  return dummyMembers.find((m) => m.id === id)!;
}

const scrollAreaRef = ref<InstanceType<typeof ScrollArea>>();
const bottomAnchorRef = ref<HTMLElement>();
const showNewMessages = ref(true);

function scrollToBottom(behavior: ScrollBehavior = "smooth") {
  bottomAnchorRef.value?.scrollIntoView({ behavior, block: "end" });
  showNewMessages.value = false;
}

// scroll to the latest message on first load, and whenever new messages arrive
watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    scrollToBottom("auto");
  },
  { immediate: true },
);
</script>

<template>
  <div class="relative min-h-0 flex-1">
    <ScrollArea ref="scrollAreaRef" class="h-full px-4 py-3">
      <HuddleEvent v-for="event in systemEvents" :key="event.id" :event="event" />

      <MessagesDivider label="Today" />

      <motion.div
        v-for="(group, gi) in groups"
        :key="gi"
        :initial="{ opacity: 0, y: 8 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.18 }"
        class="flex gap-2 pb-3"
        :class="[group[0].authorId === currentUserId ? 'flex-row-reverse' : '']"
      >
        <Avatar class="mt-0.5 h-8 w-8 shrink-0">
          <AvatarImage :src="memberOf(group[0].authorId).avatar" />
          <AvatarFallback>{{ memberOf(group[0].authorId).name[0] }}</AvatarFallback>
        </Avatar>

        <div
          class="flex max-w-[80%] min-w-0 flex-col gap-1"
          :class="[group[0].authorId === currentUserId ? 'items-end' : 'items-start']"
        >
          <div
            v-if="group[0].authorId !== currentUserId"
            class="flex items-baseline gap-2 px-1 text-xs"
          >
            <span class="font-semibold">{{ memberOf(group[0].authorId).name }}</span>
            <span class="text-muted-foreground">
              {{
                new Date(group[0].createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }}
            </span>
          </div>

          <MessageBubble
            v-for="message in group"
            :key="message.id"
            :message="message"
            :is-own="message.authorId === currentUserId"
            :show-thread-entry="props.showThreadEntry ?? true"
            @react="(...a) => emit('react', ...a)"
            @open-thread="(id) => emit('openThread', id)"
          />
        </div>
      </motion.div>

      <!-- invisible anchor used to scroll to the true bottom -->
      <div ref="bottomAnchorRef" />
    </ScrollArea>

    <Transition name="fade">
      <button
        v-if="showNewMessages"
        type="button"
        class="absolute right-4 bottom-3 flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs font-medium shadow-sm hover:bg-accent"
        @click="() => scrollToBottom()"
      >
        New messages
        <Icon name="lucide:arrow-down" size="12" />
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
