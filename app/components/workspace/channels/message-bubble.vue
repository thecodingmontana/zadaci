<script setup lang="ts">
import type { ChatMessage } from "~/types/chat";
import { Bubble, BubbleContent, BubbleReactions } from "~/components/ui/bubble";
import EmojiPicker from "~/components/workspace/channels/emoji-picker.vue";
import MessageAttachmentCard from "~/components/workspace/channels/message-attachment-card.vue";
import MessageStatus from "~/components/workspace/channels/message-status.vue";
import { dummyMembers } from "~/lib/dummy-data/channel";

const props = defineProps<{
  message: ChatMessage;
  isOwn: boolean;
  showThreadEntry?: boolean;
}>();

const emit = defineEmits<{
  react: [messageId: string, emoji: string];
  openThread: [messageId: string];
}>();

function onReact(emoji: string) {
  emit("react", props.message.id, emoji);
}
</script>

<template>
  <div class="group/message relative">
    <Bubble
      :align="isOwn ? 'end' : 'start'"
      :variant="isOwn ? 'default' : 'secondary'"
      :class="
        !isOwn
          ? '[&>[data-slot=bubble-content]]:!bg-brand [&>[data-slot=bubble-content]]:!text-white'
          : ''
      "
    >
      <BubbleContent>
        <p class="text-sm whitespace-pre-wrap">{{ message.content }}</p>
        <MessageAttachmentCard v-if="message.attachment" :attachment="message.attachment" />
      </BubbleContent>

      <BubbleReactions side="bottom" :align="isOwn ? 'end' : 'start'" class="gap-1">
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
        <EmojiPicker @select="onReact">
          <button
            type="button"
            class="flex h-6 w-6 items-center justify-center rounded-full border bg-background opacity-0 transition-opacity group-hover/message:opacity-100 hover:bg-accent"
          >
            <Icon name="lucide:smile-plus" size="12" />
          </button>
        </EmojiPicker>
        <button
          type="button"
          class="flex h-6 w-6 items-center justify-center rounded-full border bg-background opacity-0 transition-opacity group-hover/message:opacity-100 hover:bg-accent"
          aria-label="Reply in thread"
          @click="emit('openThread', message.id)"
        >
          <Icon name="lucide:message-square" size="12" />
        </button>
      </BubbleReactions>
    </Bubble>

    <div
      class="mt-1 flex items-center gap-1 text-xs text-muted-foreground"
      :class="[isOwn ? 'justify-end' : 'justify-start']"
    >
      <MessageStatus v-if="isOwn && message.status" :status="message.status" />
    </div>

    <button
      v-if="showThreadEntry && message.thread"
      type="button"
      class="mt-1 flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent"
      @click="emit('openThread', message.id)"
    >
      <div class="flex -space-x-1.5">
        <Avatar
          v-for="pid in message.thread.participantIds.slice(0, 3)"
          :key="pid"
          class="h-4 w-4 border"
        >
          <AvatarImage :src="dummyMembers.find((m) => m.id === pid)?.avatar" />
        </Avatar>
      </div>
      <span class="font-medium text-primary">{{ message.thread.count }} messages</span>
      <span class="text-muted-foreground">View thread</span>
    </button>
  </div>
</template>
