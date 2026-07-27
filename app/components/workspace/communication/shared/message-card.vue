<script setup lang="ts">
import type { ChatMessage } from "~/types/chat";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import EmojiPicker from "~/components/workspace/communication/shared/emoji-picker.vue";
import MessageAttachmentCard from "~/components/workspace/communication/shared/message-attachment-card.vue";
import ActionTooltip from "~/components/workspace/shared/action-tooltip.vue";

interface ContentSegment {
  text: string;
  isMention: boolean;
  mentionType?: "user" | "channel";
  targetId?: string;
}

interface MemberInfo {
  name: string;
  avatar: string | null;
}

const props = defineProps<{
  message: ChatMessage;
  isOwn: boolean;
  currentMemberId: string;
  members?: Map<string, MemberInfo>;
  channels?: Map<string, { name: string }>;
  showThreadEntry?: boolean;
  hideThreadReply?: boolean;
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

const memberName = computed(() => memberInfo(props.message.authorId).name);
const memberAvatar = computed(() => memberInfo(props.message.authorId).avatar);

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

const isEdited = computed(() => {
  return props.message.editedAt != null && props.message.editedAt !== props.message.createdAt;
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

const route = useRoute();
const workspaceId = computed(() => route.params.workspaceId as string);

const contentSegments = computed<ContentSegment[]>(() => {
  const content = props.message.content;
  if (!content) return [];
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  const re = /[@#]\[([^\]]+)\]([\w\u00C0-\u024F\s]+)\u200B/g;
  let match = re.exec(content);
  while (match !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: content.slice(lastIndex, match.index), isMention: false });
    }
    const raw = content[match.index];
    const isChannel = raw === "#";
    segments.push({
      text: match[2],
      isMention: true,
      mentionType: isChannel ? "channel" : "user",
      targetId: match[1],
    });
    lastIndex = match.index + match[0].length;
    match = re.exec(content);
  }
  if (lastIndex < content.length) {
    segments.push({ text: content.slice(lastIndex), isMention: false });
  }
  return segments;
});

function mentionLink(segment: ContentSegment): string {
  const base = `/workspace/${workspaceId.value}`;
  if (segment.mentionType === "user") {
    return `${base}/conversations/${segment.targetId}`;
  }
  return `${base}/channels/${segment.targetId}`;
}
</script>

<template>
  <div
    class="group/card relative flex items-start gap-2 rounded-md p-2 hover:bg-[#f2f2f2] dark:hover:bg-neutral-800"
  >
    <Avatar class="size-10 shrink-0 self-start rounded">
      <AvatarImage :src="memberAvatar ?? ''" :alt="memberName" class="rounded-md" />
      <AvatarFallback class="rounded-md">{{ initials(memberName) }}</AvatarFallback>
    </Avatar>
    <div class="min-w-0 flex-1 space-y-2 self-start">
      <div>
        <div class="flex items-baseline gap-x-1.5">
          <h3 class="text-sm font-semibold">{{ memberName }}</h3>
          <p class="text-xs text-gray-500">{{ messageTime }}</p>
        </div>
        <p class="text-sm wrap-break-word whitespace-pre-wrap text-foreground">
          <template v-for="(seg, i) in contentSegments" :key="i">
            <NuxtLink
              v-if="seg.isMention"
              :to="mentionLink(seg)"
              class="mention-pill cursor-pointer text-brand"
              >{{ seg.text }}</NuxtLink
            >
            <span v-else>{{ seg.text }}</span>
          </template>
          <span v-if="isEdited" class="ml-1 text-[10px] opacity-60">(edited)</span>
        </p>
        <MessageAttachmentCard v-if="message.attachment" :attachment="message.attachment" />
      </div>
      <div class="flex items-center gap-x-1.5">
        <div v-if="message.reactions?.length" class="flex items-center gap-1">
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
        <div class="flex items-center opacity-0 transition-opacity group-hover/card:opacity-100">
          <ActionTooltip label="Add reaction" side="bottom">
            <EmojiPicker @select="(emoji) => emit('toggleReaction', message.id, emoji)">
              <Button variant="ghost" size="icon" class="size-7 hover:bg-white">
                <Icon name="lucide:smile-plus" size="16" />
              </Button>
            </EmojiPicker>
          </ActionTooltip>
          <ActionTooltip v-if="!hideThreadReply" label="Reply" side="bottom">
            <Button
              variant="ghost"
              size="icon"
              class="size-7 hover:bg-white"
              @click="emit('openThread', message.id)"
            >
              <Icon name="ri:chat-thread-line" size="16" />
            </Button>
          </ActionTooltip>
          <ActionTooltip v-if="isOwn" label="Edit" side="bottom">
            <Button
              variant="ghost"
              size="icon"
              class="size-7 hover:bg-white"
              @click="emit('startEdit', message.id, message.content)"
            >
              <Icon name="hugeicons:quill-write-02" size="16" />
            </Button>
          </ActionTooltip>
          <ActionTooltip v-if="isOwn" label="Delete" side="bottom">
            <Button
              variant="ghost"
              size="icon"
              class="size-7 hover:bg-white hover:text-destructive"
              @click="emit('delete', message.id)"
            >
              <Icon name="hugeicons:delete-03" size="16" />
            </Button>
          </ActionTooltip>
          <ActionTooltip v-if="!isOwn" label="Message info" side="bottom">
            <Popover>
              <PopoverTrigger as-child>
                <Button variant="ghost" size="icon" class="size-7 hover:bg-white">
                  <Icon name="solar:info-circle-outline" size="16" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" class="w-56 p-3 text-sm">
                <p class="font-medium">Message info</p>
                <div class="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p>Sent {{ messageTime }}</p>
                </div>
              </PopoverContent>
            </Popover>
          </ActionTooltip>
          <ActionTooltip v-if="isOwn" label="Message info" side="bottom">
            <Popover>
              <PopoverTrigger as-child>
                <Button variant="ghost" size="icon" class="size-7 hover:bg-white">
                  <Icon name="solar:info-circle-outline" size="16" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" class="w-56 p-3 text-sm">
                <p class="font-medium">Message info</p>
                <div class="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p>Sent {{ messageTime }}</p>
                  <p v-if="deliveryStatus" class="capitalize">Status: {{ deliveryStatus }}</p>
                </div>
              </PopoverContent>
            </Popover>
          </ActionTooltip>
        </div>
      </div>

      <button
        v-if="showThreadEntry && previewData"
        type="button"
        class="flex items-center gap-2 rounded-md px-1 py-1 text-xs hover:bg-accent"
        @click="emit('openThread', message.id)"
      >
        <div class="flex -space-x-1.5">
          <Avatar
            v-for="pid in previewData.participantIds.slice(0, 3)"
            :key="pid"
            class="h-5 w-5 border-2 border-background"
          >
            <AvatarImage :src="memberInfo(pid).avatar ?? ''" :alt="memberInfo(pid).name" />
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
  </div>
</template>
