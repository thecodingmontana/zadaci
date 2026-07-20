<script setup lang="ts">
import type { ChatMessage, SystemEvent } from "~/types/chat";
import { motion } from "motion-v";

import { ScrollArea } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";
import ChannelEmptyState from "~/components/workspace/channels/channel-empty-state.vue";
import HuddleEvent from "~/components/workspace/channels/huddle-event.vue";
import MessageBubble from "~/components/workspace/channels/message-bubble.vue";
import MessagesDivider from "~/components/workspace/channels/messages-divider.vue";
const props = defineProps<{
  error?: boolean;
  messages: ChatMessage[];
  systemEvents?: SystemEvent[];
  currentMemberId: string;
  channelName?: string;
  showThreadEntry?: boolean;
  hideThreadReply?: boolean;
  hideEmptyState?: boolean;
  loading?: boolean;
  hasLoaded?: boolean;
  messageStatuses?: Map<string, "sending" | "sent" | "delivered" | "seen">;
}>();

const emit = defineEmits<{
  toggleReaction: [messageId: string, emoji: string];
  openThread: [messageId: string];
  startEdit: [messageId: string, content: string];
  delete: [messageId: string];
  loadOlder: [];
}>();

const isOwn = (authorId: string) => authorId === props.currentMemberId;

// Group messages by author (same author within ~5 min)
const groups = computed(() => {
  const result: ChatMessage[][] = [];
  for (const message of props.messages) {
    const last = result.at(-1);
    if (last) {
      const prev = last.at(-1)!;
      const sameAuthor = prev.authorId === message.authorId;
      const timeDiff = new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime();
      const withinWindow = timeDiff < 5 * 60 * 1000; // 5 minutes
      if (sameAuthor && withinWindow) {
        last.push(message);
        continue;
      }
    }
    result.push([message]);
  }
  return result;
});

// Compute day boundaries for date dividers
interface DayGroup {
  dateLabel: string;
  groups: ChatMessage[][];
}

function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (target.getTime() === today.getTime()) return "Today";
  if (target.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

const dayGroups = computed(() => {
  const result: DayGroup[] = [];
  for (const group of groups.value) {
    const date = new Date(group[0].createdAt);
    const label = formatDateLabel(date);
    const last = result.at(-1);
    if (last && last.dateLabel === label) {
      last.groups.push(group);
    } else {
      result.push({ dateLabel: label, groups: [group] });
    }
  }
  return result;
});

const scrollAreaRef = ref<InstanceType<typeof ScrollArea>>();
const bottomAnchorRef = ref<HTMLElement>();
const showNewMessages = ref(false);
const wasNearBottom = ref(true);

function isNearBottom(): boolean {
  const el = scrollAreaRef.value?.$el?.querySelector?.("[data-radix-scroll-area-viewport]");
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
}

function scrollToBottom(behavior: ScrollBehavior = "smooth") {
  bottomAnchorRef.value?.scrollIntoView({ behavior, block: "end" });
  showNewMessages.value = false;
  wasNearBottom.value = true;
}

// Auto-scroll on new messages only if already near bottom
watch(
  () => props.messages.length,
  async (newLen, oldLen) => {
    await nextTick();
    if (oldLen === 0 || newLen === 0) {
      scrollToBottom("auto");
    } else if (wasNearBottom.value) {
      scrollToBottom("auto");
    } else {
      showNewMessages.value = true;
    }
  },
  { immediate: true },
);

// Track scroll position
function onScroll() {
  wasNearBottom.value = isNearBottom();
  if (wasNearBottom.value) {
    showNewMessages.value = false;
  }
}

const showEmptyState = computed(() => {
  return !props.hideEmptyState && props.hasLoaded && props.messages.length === 0 && !props.loading;
});

const channelNameDisplay = computed(() => props.channelName ?? "general");
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col">
    <ScrollArea ref="scrollAreaRef" class="flex-1 px-4 py-3" @scroll="onScroll">
      <div v-if="loading && !hasLoaded" class="flex flex-col gap-4 py-4">
        <div
          v-for="n in 6"
          :key="n"
          class="flex w-full gap-2"
          :class="n % 2 === 0 ? 'items-end justify-end' : 'items-start'"
        >
          <Skeleton v-if="n % 2 !== 0" class="mt-0.5 h-8 w-8 shrink-0 rounded-full" />
          <div class="flex flex-col gap-2" :class="n % 2 === 0 ? 'items-end' : 'items-start'">
            <Skeleton class="h-3 w-24" />
            <Skeleton
              class="h-8 rounded-xl"
              :class="[n % 2 === 0 ? 'w-56 rounded-br-md' : 'w-64 rounded-bl-md']"
            />
            <Skeleton
              v-if="n % 3 === 0"
              class="h-8 w-48 rounded-xl"
              :class="n % 2 === 0 ? 'rounded-br-md' : 'rounded-bl-md'"
            />
          </div>
          <Skeleton v-if="n % 2 === 0" class="order-last mt-0.5 h-8 w-8 shrink-0 rounded-full" />
        </div>
      </div>
      <div v-else-if="error" class="flex flex-1 flex-col items-center justify-center py-8">
        <Icon name="lucide:server-crash" size="28" class="text-muted-foreground" />
        <p class="mt-2 text-sm text-muted-foreground">Something went wrong loading messages</p>
      </div>
      <HuddleEvent v-for="event in systemEvents" :key="event.id" :event="event" />

      <template v-for="(day, di) in dayGroups" :key="di">
        <MessagesDivider :label="day.dateLabel" />

        <motion.div
          v-for="(group, gi) in day.groups"
          :key="`${di}-${gi}`"
          :initial="{ opacity: 0, y: 8 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.18 }"
          class="flex w-full gap-2 pb-3"
          :class="[isOwn(group[0].authorId) ? 'items-end justify-end' : 'items-start']"
        >
          <Avatar
            class="mt-0.5 h-8 w-8 shrink-0"
            :class="[isOwn(group[0].authorId) ? 'order-last' : '']"
          />

          <div
            class="flex max-w-[80%] min-w-0 flex-col gap-1"
            :class="[isOwn(group[0].authorId) ? 'items-end' : 'items-start']"
          >
            <div class="px-1 text-xs">
              <span v-if="!isOwn(group[0].authorId)" class="font-semibold">{{
                group[0].authorId
              }}</span>
              <span v-else class="font-semibold text-muted-foreground">You</span>
            </div>

            <MessageBubble
              v-for="message in group"
              :key="message.id"
              :message="message"
              :is-own="isOwn(message.authorId)"
              :current-member-id="currentMemberId"
              :show-thread-entry="props.showThreadEntry ?? true"
              :hide-thread-reply="props.hideThreadReply ?? false"
              :delivery-status="props.messageStatuses?.get(message.id)"
              @toggle-reaction="(...a) => emit('toggleReaction', ...a)"
              @open-thread="(id) => emit('openThread', id)"
              @start-edit="(...a) => emit('startEdit', ...a)"
              @delete="(id) => emit('delete', id)"
            />
          </div>
        </motion.div>
      </template>

      <div ref="bottomAnchorRef" />
    </ScrollArea>

    <ChannelEmptyState
      v-if="showEmptyState"
      :name="channelNameDisplay"
      type="discussion"
      class="px-4 pb-4"
    />

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
