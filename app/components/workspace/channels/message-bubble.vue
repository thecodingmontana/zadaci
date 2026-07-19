<script setup lang="ts">
import type { ChatMessage } from "~/types/chat";
import { Bubble, BubbleContent } from "~/components/ui/bubble";
import EmojiPicker from "~/components/workspace/channels/emoji-picker.vue";
import MessageAttachmentCard from "~/components/workspace/channels/message-attachment-card.vue";
import MessageStatus from "~/components/workspace/channels/message-status.vue";

const props = defineProps<{
  message: ChatMessage;
  isOwn: boolean;
  currentMemberId: string;
  showThreadEntry?: boolean;
  // For member display - Tier 2 data resolved at UI layer
  memberName?: string;
  memberAvatar?: string;
  // Delivery status computed from receipts
  deliveryStatus?: "sending" | "sent" | "delivered" | "seen";
}>();

const emit = defineEmits<{
  toggleReaction: [messageId: string, emoji: string];
  openThread: [messageId: string];
  startEdit: [messageId: string, content: string];
}>();

const previewData = computed(() => {
  if (!props.showThreadEntry) return null;
  if (props.message.threadReplyCount > 0) {
    return {
      count: props.message.threadReplyCount,
      participantIds: props.message.threadParticipantIds,
    };
  }
  return null;
});

const isEdited = computed(() => {
  return props.message.editedAt != null && props.message.editedAt !== props.message.createdAt;
});
</script>

<template>
  <div class="group/message flex flex-col gap-1" :class="[isOwn ? 'items-end' : 'items-start']">
    <Bubble
      :align="isOwn ? 'end' : 'start'"
      :variant="isOwn ? 'default' : 'secondary'"
      :title="new Date(message.createdAt).toLocaleString()"
      :class="
        isOwn
          ? '[&>[data-slot=bubble-content]]:!bg-brand [&>[data-slot=bubble-content]]:!text-white'
          : ''
      "
    >
      <BubbleContent>
        <p class="text-sm break-words whitespace-pre-wrap">
          {{ message.content }}
          <span v-if="isEdited" class="ml-1 text-[10px] opacity-60">(edited)</span>
        </p>
        <MessageAttachmentCard v-if="message.attachment" :attachment="message.attachment" />
      </BubbleContent>
    </Bubble>

    <div class="flex items-center gap-1" :class="[isOwn ? 'justify-end' : '']">
      <div
        v-if="message.reactions?.length"
        class="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-sm ring-3 ring-card"
      >
        <button
          v-for="reaction in message.reactions"
          :key="reaction.emoji"
          type="button"
          class="flex items-center gap-1 rounded-full border bg-background px-1.5 py-0.5 text-xs hover:bg-accent"
          @click="emit('toggleReaction', message.id, reaction.emoji)"
        >
          <span>{{ reaction.emoji }}</span>
          <!-- ERROR: member_ids undefined? {{ reaction }} -->
          <span class="text-muted-foreground">?</span>
        </button>
      </div>

      <div
        class="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-sm opacity-0 ring-3 ring-card transition-opacity group-hover/message:opacity-100 has-[button]:p-0"
      >
        <EmojiPicker @select="(emoji) => emit('toggleReaction', message.id, emoji)">
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
        <button
          v-if="isOwn"
          type="button"
          class="flex h-6 w-6 items-center justify-center rounded-full border bg-background hover:bg-accent"
          aria-label="Edit message"
          @click="emit('startEdit', message.id, message.content)"
        >
          <Icon name="lucide:pencil" size="12" />
        </button>
      </div>
    </div>

    <div v-if="deliveryStatus" class="flex items-center gap-1 text-xs text-muted-foreground">
      <MessageStatus :status="deliveryStatus" />
    </div>

    <button
      v-if="showThreadEntry && previewData"
      type="button"
      class="flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent"
      @click="emit('openThread', message.id)"
    >
      <div class="flex -space-x-1.5">
        <Avatar
          v-for="pid in previewData.participantIds.slice(0, 3)"
          :key="pid"
          class="h-4 w-4 border"
        >
          <AvatarImage :src="undefined" :alt="pid" />
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
