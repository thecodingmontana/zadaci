<script setup lang="ts">
import type { ChatMessage, SystemEvent } from "~/types/chat";
import { motion } from "motion-v";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";
import ChannelEmptyState from "~/components/workspace/channels/channel-empty-state.vue";
import HuddleEvent from "~/components/workspace/channels/huddle-event.vue";
import MessageBubble from "~/components/workspace/channels/message-bubble.vue";
import MessagesDivider from "~/components/workspace/channels/messages-divider.vue";

interface MemberInfo {
  name: string;
  avatar: string | null;
}

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
  loadingMore?: boolean;
  hasMore?: boolean;
  hasMoreHistory?: boolean;
  messageStatuses?: Map<string, "sending" | "sent" | "delivered" | "seen">;
  members?: Map<string, MemberInfo>;
}>();

const emit = defineEmits<{
  toggleReaction: [messageId: string, emoji: string];
  openThread: [messageId: string];
  startEdit: [messageId: string, content: string];
  delete: [messageId: string];
  loadOlder: [];
}>();

function memberInfo(authorId: string): MemberInfo {
  return props.members?.get(authorId) ?? { name: authorId, avatar: null };
}

function initials(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

const isOwn = (authorId: string) => authorId === props.currentMemberId;

const groups = computed(() => {
  const result: ChatMessage[][] = [];
  for (const message of props.messages) {
    const last = result.at(-1);
    if (last) {
      const prev = last.at(-1)!;
      const sameAuthor = prev.authorId === message.authorId;
      const timeDiff = new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime();
      const withinWindow = timeDiff < 5 * 60 * 1000;
      if (sameAuthor && withinWindow) {
        last.push(message);
        continue;
      }
    }
    result.push([message]);
  }
  return result;
});

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
const topAnchorRef = ref<HTMLElement>();
const showNewMessages = ref(false);
const showScrollTop = ref(false);
const wasNearBottom = ref(true);
const loadingOlder = ref(false);
const hasInitialized = ref(false);

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

function scrollToTop(behavior: ScrollBehavior = "smooth") {
  const el = getScrollEl();
  if (el) {
    el.scrollTo({ top: 0, behavior });
  }
  showScrollTop.value = false;
}

function onLoadOlderClick() {
  loadingOlder.value = true;
  emit("loadOlder");
}

watch(
  () => props.messages.length,
  async (newLen, oldLen) => {
    await nextTick();
    if (loadingOlder.value) {
      loadingOlder.value = false;
      return;
    }
    if (oldLen === 0 && newLen > 0 && !hasInitialized.value) {
      hasInitialized.value = true;
      setTimeout(scrollToBottom, 100, "auto");
    } else if (oldLen === 0 || newLen === 0) {
      scrollToBottom("auto");
    } else if (wasNearBottom.value) {
      scrollToBottom("auto");
    } else {
      showNewMessages.value = true;
    }
  },
  { immediate: true },
);

function isNearTop(el: Element): boolean {
  return el.scrollTop < 150;
}

let loadOlderGuard = false;

watch(
  () => props.loadingMore,
  (v) => {
    loadingOlder.value = !!v;
  },
);

function getScrollEl(): Element | null {
  return scrollAreaRef.value?.$el?.querySelector?.("[data-radix-scroll-area-viewport]") ?? null;
}

function onScroll() {
  wasNearBottom.value = isNearBottom();
  if (wasNearBottom.value) {
    showNewMessages.value = false;
  }

  const el = getScrollEl();
  if (!el) return;

  showScrollTop.value = el.scrollTop > 600;

  if (
    isNearTop(el) &&
    !loadingOlder.value &&
    !loadOlderGuard &&
    props.hasLoaded &&
    props.messages.length > 0
  ) {
    loadOlderGuard = true;
    emit("loadOlder");
    nextTick(() => {
      loadOlderGuard = false;
    });
  }
}

const showEmptyState = computed(() => {
  return !props.hideEmptyState && props.hasLoaded && props.messages.length === 0 && !props.loading;
});

const canLoadMore = computed(() => {
  return props.hasLoaded && (props.hasMore || props.hasMoreHistory);
});

const channelNameDisplay = computed(() => props.channelName ?? "general");
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col">
    <ScrollArea ref="scrollAreaRef" class="min-h-0 flex-1 px-4 py-3" @scroll="onScroll">
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

      <div ref="topAnchorRef" />

      <div v-if="loadingMore" class="flex justify-center py-3">
        <Icon name="lucide:loader-2" size="16" class="animate-spin text-muted-foreground" />
      </div>

      <div v-if="canLoadMore && !loadingMore" class="flex items-center gap-2 py-2">
        <div class="h-px flex-1 border-t border-dotted" />
        <button
          type="button"
          class="shrink-0 rounded-full border px-4 py-1 text-xs text-muted-foreground hover:text-foreground"
          @click="onLoadOlderClick"
        >
          Load older messages
        </button>
        <div class="h-px flex-1 border-t border-dotted" />
      </div>

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
          <Avatar v-if="!isOwn(group[0].authorId)" class="mt-0.5 h-8 w-8 shrink-0">
            <AvatarImage
              :src="memberInfo(group[0].authorId).avatar ?? undefined"
              :alt="memberInfo(group[0].authorId).name"
            />
            <AvatarFallback>{{ initials(memberInfo(group[0].authorId).name) }}</AvatarFallback>
          </Avatar>

          <div
            class="flex max-w-[80%] min-w-0 flex-col gap-1"
            :class="[isOwn(group[0].authorId) ? 'items-end' : 'items-start']"
          >
            <div class="px-1 text-xs">
              <span v-if="!isOwn(group[0].authorId)" class="font-semibold">{{
                memberInfo(group[0].authorId).name
              }}</span>
              <span v-else class="font-semibold text-muted-foreground">You</span>
            </div>

            <MessageBubble
              v-for="message in group"
              :key="message.id"
              :message="message"
              :is-own="isOwn(message.authorId)"
              :current-member-id="currentMemberId"
              :members="props.members"
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

    <!-- Scroll-to-top button -->
    <motion.button
      v-if="showScrollTop"
      type="button"
      :initial="{ opacity: 0, scale: 0.8 }"
      :animate="{ opacity: 1, scale: 1 }"
      :transition="{ duration: 0.15 }"
      class="absolute top-3 right-4 z-10 flex size-9 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent"
      @click="scrollToTop()"
    >
      <Icon name="lucide:chevron-up" size="16" />
    </motion.button>

    <!-- New messages button -->
    <motion.button
      v-if="showNewMessages"
      type="button"
      :initial="{ opacity: 0, y: 8 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ duration: 0.15 }"
      class="absolute right-4 bottom-3 z-10 flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-accent"
      @click="() => scrollToBottom()"
    >
      <Icon name="lucide:arrow-down" size="14" />
      New messages
    </motion.button>

    <!-- Bottom scroll-to button when scrolled up (no new messages) -->
    <motion.button
      v-if="!showNewMessages && !wasNearBottom && hasInitialized"
      type="button"
      :initial="{ opacity: 0, scale: 0.8 }"
      :animate="{ opacity: 1, scale: 1 }"
      :transition="{ duration: 0.15 }"
      class="absolute right-4 bottom-3 z-10 flex size-9 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent"
      @click="() => scrollToBottom()"
    >
      <Icon name="lucide:chevron-down" size="16" />
    </motion.button>
  </div>
</template>
