<script setup lang="ts">
import type { ChatMessage } from "~/types/chat";
import { Bubble, BubbleContent } from "~/components/ui/bubble";
import EmojiPicker from "~/components/workspace/channels/emoji-picker.vue";
import MessageAttachmentCard from "~/components/workspace/channels/message-attachment-card.vue";
import MessageStatus from "~/components/workspace/channels/message-status.vue";
import { dummyMembers } from "~/lib/dummy-data/channel";

const props = defineProps<{
  message: ChatMessage;
  isOwn: boolean;
  showThreadEntry?: boolean;
  threadMeta?: { count: number; participantIds: string[] } | null;
}>();

const emit = defineEmits<{
  react: [messageId: string, emoji: string];
  openThread: [messageId: string];
}>();

function onReact(emoji: string) {
  emit("react", props.message.id, emoji);
}

const previewData = computed(() => {
  return props.threadMeta ?? props.message.thread ?? null;
});
</script>

<template>
  <div class="group/message">
    <Bubble
      :align="isOwn ? 'end' : 'start'"
      :variant="isOwn ? 'default' : 'secondary'"
      :class="
        isOwn
          ? '[&>[data-slot=bubble-content]]:!bg-brand [&>[data-slot=bubble-content]]:!text-white'
          : ''
      "
    >
      <BubbleContent>
        <p class="text-sm whitespace-pre-wrap">{{ message.content }}</p>
        <MessageAttachmentCard v-if="message.attachment" :attachment="message.attachment" />
      </BubbleContent>
    </Bubble>

    <div class="mt-1.5 flex items-center gap-1" :class="[isOwn ? 'justify-end' : '']">
      <div
        v-if="message.reactions?.length"
        class="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-sm ring-3 ring-card"
      >
        <button
          v-for="reaction in message.reactions"
          :key="reaction.emoji"
          type="button"
          class="flex items-center gap-1 rounded-full border bg-background px-1.5 py-0.5 text-xs hover:bg-accent"
          @click="onReact(reaction.emoji)"
        >
          <span>{{ reaction.emoji }}</span>
          <span class="text-muted-foreground">{{ reaction.count }}</span>
        </button>
      </div>

      <div
        class="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-sm opacity-0 ring-3 ring-card transition-opacity group-hover/message:opacity-100 has-[button]:p-0"
      >
        <EmojiPicker @select="onReact">
          <button
            type="button"
            class="flex h-6 w-6 items-center justify-center rounded-full border bg-background hover:bg-accent"
          >
            <Icon name="lucide:smile-plus" size="12" />
          </button>
        </EmojiPicker>
        <button
          type="button"
          class="flex h-6 w-6 items-center justify-center rounded-full border bg-background hover:bg-accent"
          aria-label="Reply in thread"
          @click="emit('openThread', message.id)"
        >
          <Icon name="lucide:message-square" size="12" />
        </button>
      </div>
    </div>

    <div
      class="mt-1 flex items-center gap-1 text-xs text-muted-foreground"
      :class="[isOwn ? 'justify-end' : 'justify-start']"
    >
      <MessageStatus v-if="isOwn && message.status" :status="message.status" />
    </div>

    <button
      v-if="showThreadEntry && previewData"
      type="button"
      class="mt-1.5 flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent"
      @click="emit('openThread', message.id)"
    >
      <div class="flex -space-x-1.5">
        <Avatar
          v-for="pid in previewData.participantIds.slice(0, 3)"
          :key="pid"
          class="h-4 w-4 border"
        >
          <AvatarImage :src="dummyMembers.find((m) => m.id === pid)?.avatar" />
        </Avatar>
        <span
          v-if="previewData.participantIds.length > 3"
          class="flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground/20 text-[10px] font-medium text-muted-foreground"
        >
          +{{ previewData.participantIds.length - 3 }}
        </span>
      </div>
      <span class="font-medium text-foreground">{{ previewData.count }} Messages</span>
      <span class="text-primary">View thread</span>
    </button>
  </div>
</template>
