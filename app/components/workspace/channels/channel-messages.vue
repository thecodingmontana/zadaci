<script setup lang="ts">
import type { ChatMessage, SystemEvent } from "~/types/chat";
import { motion } from "motion-v";
import { ScrollArea } from "~/components/ui/scroll-area";
import ChannelEmptyState from "~/components/workspace/channels/channel-empty-state.vue";
import HuddleEvent from "~/components/workspace/channels/huddle-event.vue";
import MessageBubble from "~/components/workspace/channels/message-bubble.vue";
import MessagesDivider from "~/components/workspace/channels/messages-divider.vue";

const props = defineProps<{
  messages: ChatMessage[];
  systemEvents?: SystemEvent[];
  currentMemberId: string;
  channelName?: string;
  showThreadEntry?: boolean;
  loading?: boolean;
  hasLoaded?: boolean;
}>();

const emit = defineEmits<{
  toggleReaction: [messageId: string, emoji: string];
  openThread: [messageId: string];
  editMessage: [messageId: string, content: string];
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
  return props.hasLoaded && props.messages.length === 0 && !props.loading;
});

const channelNameDisplay = computed(() => props.channelName ?? "general");
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col">
    <ScrollArea ref="scrollAreaRef" class="flex-1 px-4 py-3" @scroll="onScroll">
      <HuddleEvent v-for="event in systemEvents" :key="event.id" :event="event" />

      <template v-for="(day, di) in dayGroups" :key="di">
        <MessagesDivider :label="day.dateLabel" />

        <motion.div
          v-for="(group, gi) in day.groups"
          :key="`${di}-${gi}`"
          :initial="{ opacity: 0, y: 8 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.18 }"
          class="flex items-start gap-2 pb-3"
          :class="[isOwn(group[0].authorId) ? 'justify-end' : '']"
        >
          <Avatar
            class="mt-0.5 h-8 w-8 shrink-0"
            :class="[isOwn(group[0].authorId) ? 'order-last' : '']"
          />

          <div
            class="flex max-w-[80%] min-w-0 flex-col gap-1"
            :class="[isOwn(group[0].authorId) ? 'items-end' : 'items-start']"
          >
            <div v-if="!isOwn(group[0].authorId)" class="flex items-baseline gap-2 px-1 text-xs">
              <span class="font-semibold">{{ group[0].authorId }}</span>
              <span
                class="text-muted-foreground"
                :title="new Date(group[0].createdAt).toLocaleString()"
              >
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
              :is-own="isOwn(message.authorId)"
              :current-member-id="currentMemberId"
              :show-thread-entry="props.showThreadEntry ?? true"
              @toggle-reaction="(...a) => emit('toggleReaction', ...a)"
              @open-thread="(id) => emit('openThread', id)"
              @edit-message="(...a) => emit('editMessage', ...a)"
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
