<script setup lang="ts">
import type { ChatMessage } from "~/types/chat";
import { formatDistanceToNow } from "date-fns";
import EmojiPicker from "~/components/workspace/communication/shared/emoji-picker.vue";
import MessageAttachmentCard from "~/components/workspace/communication/shared/message-attachment-card.vue";
import MessageStatus from "~/components/workspace/communication/shared/message-status.vue";

interface MemberInfo {
  name: string;
  avatar: string | null;
}

const props = defineProps<{
  message: ChatMessage;
  isOwn: boolean;
  currentMemberId: string;
  showThreadEntry?: boolean;
  hideActions?: boolean;
  hideThreadReply?: boolean;
  showHeader?: boolean;
  memberName?: string;
  memberAvatar?: string;
  members?: Map<string, MemberInfo>;
  deliveryStatus?: "sending" | "sent" | "delivered" | "seen";
}>();

const emit = defineEmits<{
  toggleReaction: [messageId: string, emoji: string];
  openThread: [messageId: string];
  startEdit: [messageId: string, content: string];
  delete: [messageId: string];
}>();

function memberInfo(memberId: string): MemberInfo {
  return props.members?.get(memberId) ?? { name: memberId, avatar: null };
}

function initials(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

const displayName = computed(() => {
  if (props.isOwn) return "You";
  return props.memberName ?? memberInfo(props.message.authorId).name;
});

const previewData = computed(() => {
  if (!props.showThreadEntry) return null;
  if (props.message.threadReplyCount > 0) {
    const label = `${props.message.threadReplyCount} ${props.message.threadReplyCount === 1 ? "reply" : "replies"}`;
    let timeLabel = "";
    if (props.message.threadLastReplyAt) {
      try {
        timeLabel = formatDistanceToNow(new Date(props.message.threadLastReplyAt), {
          addSuffix: true,
          includeSeconds: true,
        });
      } catch {
        // ignore
      }
    }
    return {
      count: props.message.threadReplyCount,
      participantIds: props.message.threadParticipantIds,
      label,
      timeLabel,
    };
  }
  return null;
});

const isEdited = computed(() => {
  return props.message.editedAt != null && props.message.editedAt !== props.message.createdAt;
});

const messageTime = computed(() => {
  try {
    return formatDistanceToNow(new Date(props.message.createdAt), {
      includeSeconds: true,
      addSuffix: true,
    });
  } catch {
    return "";
  }
});
</script>

<template>
  <div class="group/message flex w-full flex-col" :class="[isOwn ? 'items-end' : 'items-start']">
    <div v-if="showHeader" class="flex items-baseline gap-2 px-1 text-xs">
      <span class="font-semibold text-foreground">{{ displayName }}</span>
      <span class="text-muted-foreground">{{ messageTime }}</span>
    </div>

    <div class="max-w-full px-1">
      <p class="text-sm wrap-break-word whitespace-pre-wrap text-foreground">
        {{ message.content }}
        <span v-if="isEdited" class="ml-1 text-[10px] opacity-60">(edited)</span>
      </p>
      <MessageAttachmentCard v-if="message.attachment" :attachment="message.attachment" />
    </div>

    <div
      v-if="!hideActions"
      class="flex items-center gap-1 px-1"
      :class="[isOwn ? 'justify-end' : '']"
    >
      <div
        v-if="message.reactions?.length"
        class="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-sm"
      >
        <button
          v-for="reaction in message.reactions"
          :key="reaction.emoji"
          type="button"
          class="flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs hover:bg-accent"
          :class="[
            reaction.member_ids?.includes(currentMemberId)
              ? 'border-primary bg-primary/10'
              : 'bg-background',
          ]"
          @click="emit('toggleReaction', message.id, reaction.emoji)"
        >
          <span>{{ reaction.emoji }}</span>
          <span v-if="(reaction.member_ids?.length ?? 0) > 1" class="text-muted-foreground">{{
            reaction.member_ids.length
          }}</span>
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
          v-if="!hideThreadReply"
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
        <button
          v-if="isOwn"
          type="button"
          class="hover:text-destructive-foreground flex h-6 w-6 items-center justify-center rounded-full border bg-background hover:bg-destructive"
          aria-label="Delete message"
          @click="emit('delete', message.id)"
        >
          <Icon name="lucide:trash-2" size="12" />
        </button>
      </div>
    </div>

    <div v-if="deliveryStatus" class="flex items-center gap-1 px-1 text-xs text-muted-foreground">
      <MessageStatus :status="deliveryStatus" />
    </div>

    <!-- Thread reply preview — matches Image 1: avatar(s) + "N reply/replies" + relative time -->
    <button
      v-if="showThreadEntry && previewData"
      type="button"
      class="mt-1 flex items-center gap-2 rounded-md px-1 py-1 text-xs hover:bg-accent"
      @click="emit('openThread', message.id)"
    >
      <div class="flex -space-x-1.5">
        <Avatar
          v-for="pid in previewData.participantIds.slice(0, 3)"
          :key="pid"
          class="h-5 w-5 border-2 border-background"
        >
          <AvatarImage :src="memberInfo(pid).avatar ?? undefined" :alt="memberInfo(pid).name" />
          <AvatarFallback class="text-[9px]">{{ initials(memberInfo(pid).name) }}</AvatarFallback>
        </Avatar>
        <span
          v-if="previewData.participantIds.length > 3"
          class="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/20 text-[9px] font-medium text-muted-foreground"
        >
          +{{ previewData.participantIds.length - 3 }}
        </span>
      </div>
      <span class="font-semibold text-primary">{{ previewData.label }}</span>
      <span v-if="previewData.timeLabel" class="text-muted-foreground">{{
        previewData.timeLabel
      }}</span>
    </button>
  </div>
</template>
