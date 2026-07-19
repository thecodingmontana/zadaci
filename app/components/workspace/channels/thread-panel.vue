<script setup lang="ts">
import type { ChatMessage, Thread } from "~/types/chat";
import ChannelComposer from "~/components/workspace/channels/channel-composer.vue";
import ChannelMessages from "~/components/workspace/channels/channel-messages.vue";

const props = defineProps<{
  thread: Thread;
  currentMemberId: string;
}>();
const emit = defineEmits<{
  close: [];
  reply: [parentMessageId: string, content: string];
}>();

const allMessages = computed<ChatMessage[]>(() => [
  props.thread.parentMessage,
  ...props.thread.replies,
]);
</script>

<template>
  <div class="flex h-full w-[360px] flex-col border-l">
    <div class="flex items-center gap-2 border-b px-4 py-3">
      <Button variant="ghost" size="icon-xs" aria-label="Back to channel" @click="emit('close')">
        <Icon name="lucide:chevron-left" size="16" />
      </Button>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold">Thread</p>
        <p class="truncate text-xs text-muted-foreground"># general</p>
      </div>
      <Button variant="ghost" size="icon-xs" aria-label="Close thread" @click="emit('close')">
        <Icon name="lucide:x" size="16" />
      </Button>
    </div>

    <ChannelMessages
      :messages="allMessages"
      :show-thread-entry="false"
      :current-member-id="currentMemberId"
      @toggle-reaction="() => {}"
      @open-thread="() => {}"
      @edit-message="() => {}"
    />
    <ChannelComposer
      typing-label=""
      placeholder="Reply in thread"
      @send="(content) => emit('reply', thread.parentMessageId, content)"
    />
  </div>
</template>
