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
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}

interface ContentBlock {
  type: "paragraph" | "quote" | "code" | "heading" | "list";
  segments: ContentSegment[];
  headingLevel?: number;
  listType?: string;
  language?: string;
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

const LEXICAL_V1_PREFIX = "LEXICAL_V1:";
const copiedBlocks = ref<Set<number>>(new Set());

function decodeFormat(
  fmt: number,
): Pick<ContentSegment, "bold" | "italic" | "underline" | "strikethrough" | "code"> {
  return {
    bold: (fmt & 1) !== 0,
    italic: (fmt & 2) !== 0,
    underline: (fmt & 8) !== 0,
    strikethrough: (fmt & 4) !== 0,
    code: (fmt & 16) !== 0,
  };
}

function segmentsFromNodes(nodes: any[]): ContentSegment[] {
  const segs: ContentSegment[] = [];
  for (const node of nodes) {
    if (node.type === "mention") {
      segs.push({
        text: node.mentionName,
        isMention: true,
        mentionType: node.targetType,
        targetId: node.targetId,
      });
    } else if (node.type === "text" || node.type === "code-highlight") {
      segs.push({
        text: node.text ?? "",
        isMention: false,
        ...decodeFormat(node.format ?? 0),
      });
    } else if (node.type === "linebreak") {
      segs.push({ text: "\n", isMention: false });
    } else if (node.type === "tab") {
      segs.push({ text: "\t", isMention: false });
    } else if (node.children) {
      segs.push(...segmentsFromNodes(node.children));
    }
  }
  return segs;
}

function renderLexicalContent(raw: string): ContentBlock[] {
  let json: any;
  try {
    json = JSON.parse(raw.slice(LEXICAL_V1_PREFIX.length));
  } catch {
    return [{ type: "paragraph", segments: [{ text: raw, isMention: false }] }];
  }
  const blocks: ContentBlock[] = [];
  const children: any[] = json?.root?.children ?? [];
  for (const child of children) {
    const t = child.type;
    if (t === "quote") {
      blocks.push({ type: "quote", segments: segmentsFromNodes(child.children ?? []) });
    } else if (t === "code") {
      blocks.push({
        type: "code",
        segments: segmentsFromNodes(child.children ?? []),
        language: child.language ?? "text",
      });
    } else if (t === "heading") {
      blocks.push({
        type: "heading",
        segments: segmentsFromNodes(child.children ?? []),
        headingLevel: child.tag?.[1] ? Number(child.tag[1]) : 1,
      });
    } else if (t === "list") {
      const listSegs: ContentSegment[] = [];
      for (const item of child.children ?? []) {
        if (item.children) {
          listSegs.push(...segmentsFromNodes(item.children));
        }
      }
      blocks.push({ type: "list", segments: listSegs, listType: child.listType });
    } else {
      blocks.push({ type: "paragraph", segments: segmentsFromNodes(child.children ?? []) });
    }
  }
  return blocks;
}

function parseLegacyContent(content: string): ContentBlock[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  const re = /[@#]\[([^\]]+)\]([\w\u00C0-\u024F\s]+)\u200B/g;
  let match = re.exec(content);
  while (match !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: content.slice(lastIndex, match.index), isMention: false });
    }
    const rawChar = content[match.index];
    const isChannel = rawChar === "#";
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
  return [{ type: "paragraph", segments }];
}

const contentBlocks = computed<ContentBlock[]>(() => {
  const raw = props.message.content;
  if (!raw) return [];
  if (raw.startsWith(LEXICAL_V1_PREFIX)) {
    return renderLexicalContent(raw);
  }
  return parseLegacyContent(raw);
});

function copyCode(blockIdx: number) {
  const block = contentBlocks.value[blockIdx];
  if (!block) return;
  const text = block.segments.map((s) => s.text).join("");
  navigator.clipboard.writeText(text);
  copiedBlocks.value = new Set(copiedBlocks.value).add(blockIdx);
  setTimeout(() => {
    const next = new Set(copiedBlocks.value);
    next.delete(blockIdx);
    copiedBlocks.value = next;
  }, 2000);
}

function mentionLink(segment: ContentSegment): string {
  const base = `/workspace/${workspaceId.value}`;
  if (segment.mentionType === "user") {
    return `${base}/conversations/${segment.targetId}`;
  }
  return `${base}/channels/${segment.targetId}`;
}

function segmentClasses(seg: ContentSegment): (string | Record<string, boolean>)[] {
  return [
    {
      "font-bold": !!seg.bold,
      italic: !!seg.italic,
      underline: !!seg.underline,
      "line-through": !!seg.strikethrough,
    },
    ...(seg.code ? ["bg-muted", "px-1", "rounded", "text-[90%]", "font-mono"] : []),
  ];
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
        <div class="space-y-1 text-sm wrap-break-word whitespace-pre-wrap text-foreground">
          <template v-for="(block, bi) in contentBlocks" :key="bi">
            <blockquote
              v-if="block.type === 'quote'"
              class="border-l-2 border-muted-foreground/30 pl-3 italic"
            >
              <template v-for="(seg, si) in block.segments" :key="si">
                <NuxtLink
                  v-if="seg.isMention"
                  :to="mentionLink(seg)"
                  class="mention-pill cursor-pointer text-brand"
                  >{{ seg.text }}</NuxtLink
                >
                <code v-else-if="seg.code" class="rounded bg-muted px-1 font-mono text-[90%]">{{
                  seg.text
                }}</code>
                <span v-else :class="segmentClasses(seg)">{{ seg.text }}</span>
              </template>
            </blockquote>
            <div
              v-else-if="block.type === 'code'"
              class="code-block-group group relative overflow-hidden rounded-md border text-sm"
            >
              <button
                type="button"
                class="absolute top-1.5 right-1.5 z-10 flex items-center gap-1 rounded bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-opacity hover:bg-background/90"
                @click="copyCode(bi)"
              >
                <template v-if="copiedBlocks.has(bi)">
                  <Icon name="lucide:check" size="12" />
                  Copied
                </template>
                <template v-else>
                  <Icon name="lucide:copy" size="12" />
                  Copy
                </template>
              </button>
              <Shiki
                v-if="block.language"
                :lang="block.language"
                :code="block.segments.map((s) => s.text).join('')"
                as="pre"
                unwrap
              />
              <pre v-else class="code-block-pre overflow-x-auto p-3 text-sm leading-relaxed">
                <code class="block font-mono">{{ block.segments.map(s => s.text).join('') }}</code>
              </pre>
            </div>
            <h3
              v-else-if="block.type === 'heading'"
              :class="[
                block.headingLevel === 1
                  ? 'text-lg font-bold'
                  : block.headingLevel === 2
                    ? 'text-base font-bold'
                    : 'text-sm font-semibold',
              ]"
            >
              <template v-for="(seg, si) in block.segments" :key="si">
                <NuxtLink
                  v-if="seg.isMention"
                  :to="mentionLink(seg)"
                  class="mention-pill cursor-pointer text-brand"
                  >{{ seg.text }}</NuxtLink
                >
                <code v-else-if="seg.code" class="rounded bg-muted px-1 font-mono text-[90%]">{{
                  seg.text
                }}</code>
                <span v-else :class="segmentClasses(seg)">{{ seg.text }}</span>
              </template>
            </h3>
            <ul
              v-else-if="block.type === 'list' && block.listType === 'bullet'"
              class="list-disc pl-5"
            >
              <li v-for="(seg, si) in block.segments" :key="si">
                <NuxtLink
                  v-if="seg.isMention"
                  :to="mentionLink(seg)"
                  class="mention-pill cursor-pointer text-brand"
                  >{{ seg.text }}</NuxtLink
                >
                <code v-else-if="seg.code" class="rounded bg-muted px-1 font-mono text-[90%]">{{
                  seg.text
                }}</code>
                <span v-else :class="segmentClasses(seg)">{{ seg.text }}</span>
              </li>
            </ul>
            <ol
              v-else-if="block.type === 'list' && block.listType === 'number'"
              class="list-decimal pl-5"
            >
              <li v-for="(seg, si) in block.segments" :key="si">
                <NuxtLink
                  v-if="seg.isMention"
                  :to="mentionLink(seg)"
                  class="mention-pill cursor-pointer text-brand"
                  >{{ seg.text }}</NuxtLink
                >
                <code v-else-if="seg.code" class="rounded bg-muted px-1 font-mono text-[90%]">{{
                  seg.text
                }}</code>
                <span v-else :class="segmentClasses(seg)">{{ seg.text }}</span>
              </li>
            </ol>
            <p v-else class="text-sm text-foreground">
              <template v-for="(seg, si) in block.segments" :key="si">
                <NuxtLink
                  v-if="seg.isMention"
                  :to="mentionLink(seg)"
                  class="mention-pill cursor-pointer text-brand"
                  >{{ seg.text }}</NuxtLink
                >
                <code v-else-if="seg.code" class="rounded bg-muted px-1 font-mono text-[90%]">{{
                  seg.text
                }}</code>
                <span v-else :class="segmentClasses(seg)">{{ seg.text }}</span>
              </template>
            </p>
          </template>
          <span v-if="isEdited" class="ml-1 text-[10px] opacity-60">(edited)</span>
        </div>
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

<style scoped>
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: hsl(var(--border));
  border-radius: 4px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
</style>

<style>
.code-block-group .shiki,
.code-block-pre {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.8125rem;
  line-height: 1.5;
  padding: 0.75rem;
  overflow-x: auto;
  margin: 0;
  background-color: var(--shiki-light-bg, #ffffff);
}
html.dark .code-block-group .shiki,
html.dark .code-block-group .shiki * {
  color: var(--shiki-dark) !important;
  background-color: var(--shiki-dark-bg) !important;
}
</style>
