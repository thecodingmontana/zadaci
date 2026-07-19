<script setup lang="ts">
import type { Thread } from "~/types/chat";
import { computed, ref } from "vue";
import ChannelComposer from "~/components/workspace/channels/channel-composer.vue";
import ChannelMessages from "~/components/workspace/channels/channel-messages.vue";

const props = defineProps<{ thread: Thread }>();
const emit = defineEmits<{ close: [] }>();

const localReplies = ref([...props.thread.replies]);
const allMessages = computed(() => [props.thread.parentMessage, ...localReplies.value]);

function onSend(content: string) {
  localReplies.value.push({
    id: `r${Date.now()}`,
    authorId: "me",
    content,
    createdAt: new Date().toISOString(),
    status: "sent",
  });
}
</script>

<template>
  <div class="flex h-full w-[360px] flex-col border-l">
    <div class="flex items-center gap-2 border-b px-4 py-3">
      <Button variant="ghost" size="icon-xs" aria-label="Back to channel" @click="emit('close')">
        <Icon name="lucide:chevron-left" size="16" />
      </Button>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold">Thread</p>
        <p class="truncate text-xs text-muted-foreground"># General</p>
      </div>
      <Button variant="ghost" size="icon-xs" aria-label="Close thread" @click="emit('close')">
        <Icon name="lucide:x" size="16" />
      </Button>
    </div>

    <ChannelMessages
      :messages="allMessages"
      :show-thread-entry="false"
      @react="() => {}"
      @open-thread="() => {}"
    />
    <ChannelComposer typing-label="" placeholder="Reply in thread" @send="onSend" />
  </div>
</template>
