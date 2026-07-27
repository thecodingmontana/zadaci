<script setup lang="ts">
import type { LexicalEditor } from "lexical";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { MarkNode } from "@lexical/mark";
import { ELEMENT_TRANSFORMERS, TEXT_FORMAT_TRANSFORMERS } from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $createParagraphNode, $createTextNode, $getRoot, $isTextNode } from "lexical";
import { LexicalComposer } from "lexical-vue/LexicalComposer";
import { ContentEditable } from "lexical-vue/LexicalContentEditable";
import { HistoryPlugin } from "lexical-vue/LexicalHistoryPlugin";
import { LinkPlugin } from "lexical-vue/LexicalLinkPlugin";
import { ListPlugin } from "lexical-vue/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "lexical-vue/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "lexical-vue/LexicalOnChangePlugin";
import { RichTextPlugin } from "lexical-vue/LexicalRichTextPlugin";
import { Button } from "~/components/ui/button";
import ActionTooltip from "~/components/workspace/shared/action-tooltip.vue";
import CodeHighlightPlugin from "./code-highlight-plugin.vue";
import ComposerToolbar from "./composer-toolbar.vue";
import { $isMentionNode, MentionNode } from "./mention-node";
import MentionsPlugin from "./mentions-plugin.vue";

interface MemberInfo {
  name: string;
  avatar: string | null;
}

const props = defineProps<{
  typingLabel?: string;
  placeholder?: string;
  editingMessageId?: string | null;
  editingContent?: string;
  replyingTo?: string | null;
  members?: Map<string, MemberInfo>;
  currentMemberId?: string;
  disableMentions?: boolean;
  channels?: Map<string, { name: string }>;
}>();
const emit = defineEmits<{
  send: [content: string];
  cancelEdit: [];
  cancelReply: [];
  typing: [];
}>();

const contentText = ref("");
const editorRef = ref<LexicalEditor | null>(null);
const isRichMode = ref(false);
let typingDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const initialConfig = {
  namespace: "MessageComposer",
  theme: {
    paragraph: "mb-0",
    text: {
      bold: "font-bold",
      italic: "italic",
      underline: "underline",
      strikethrough: "line-through",
      underlineStrikethrough: "underline line-through",
    },
    list: {
      ul: "list-disc ml-4",
      ol: "list-decimal ml-4",
      listitem: "mb-0",
    },
    link: "text-primary underline",
  },
  onError: (error: Error) => {
    console.error("Lexical error:", error);
  },
  nodes: [
    ListNode,
    ListItemNode,
    LinkNode,
    AutoLinkNode,
    MarkNode,
    HeadingNode,
    QuoteNode,
    CodeNode,
    CodeHighlightNode,
    MentionNode,
  ],
};

function serializeContent(): string {
  let result = "";
  const root = $getRoot();
  for (const child of root.getChildren()) {
    for (const node of child.getChildren()) {
      if ($isMentionNode(node)) {
        const trigger = node.__mentionType === "channel" ? "#" : "@";
        result += `${trigger + node.__mentionName}\u200B`;
      } else if ($isTextNode(node)) {
        result += node.getTextContent();
      }
    }
    result += "\n";
  }
  return result.trim();
}

function onChange(editorState?: any, editor?: any) {
  editorRef.value = editor as LexicalEditor;
  const text = (editorState as any).read ? (editorState as any).read(() => serializeContent()) : "";
  contentText.value = text;
  if (contentText.value.trim()) {
    emit("typing");
    if (typingDebounceTimer) clearTimeout(typingDebounceTimer);
    typingDebounceTimer = setTimeout(() => {
      emit("typing");
    }, 3000);
  }
}

function send() {
  const value = contentText.value.trim();
  if (!value) return;
  emit("send", value);
  editorRef.value?.update(() => {
    $getRoot().clear();
  });
  contentText.value = "";
  isRichMode.value = false;
}

function cancelEdit() {
  contentText.value = "";
  editorRef.value?.update(() => {
    $getRoot().clear();
  });
  emit("cancelEdit");
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
}

function toggleRichMode() {
  isRichMode.value = !isRichMode.value;
}

watch(
  [() => props.editingContent, () => props.editingMessageId, editorRef],
  ([content, msgId, editor]) => {
    if (content && msgId && editor) {
      editor.update(() => {
        $getRoot().clear();
        const paragraph = $createParagraphNode();
        const re = /(@[\w\u00C0-\u024F]+(?:\s[\w\u00C0-\u024F]+)*|#[\w-]+)/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        const membersByName = new Map<string, string>();
        if (props.members) {
          for (const [mid, minfo] of props.members) {
            const key = minfo.name.toLowerCase();
            if (!membersByName.has(key)) membersByName.set(key, mid);
          }
        }
        match = re.exec(content);
        while (match !== null) {
          if (match.index > lastIndex) {
            paragraph.append($createTextNode(content.slice(lastIndex, match.index)));
          }
          const raw = match[1];
          const isChannel = raw.startsWith("#");
          const name = raw.slice(1);
          const id = isChannel ? "" : (membersByName.get(name.toLowerCase()) ?? "");
          if (id) {
            const mn = $createMentionNode("user", name, id);
            paragraph.append(mn);
          } else {
            paragraph.append($createTextNode(raw));
          }
          lastIndex = match.index + raw.length;
          match = re.exec(content);
        }
        if (lastIndex < content.length) {
          paragraph.append($createTextNode(content.slice(lastIndex)));
        }
        $getRoot().append(paragraph);
      });
      nextTick(() => editor.focus());
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="px-4 py-3">
    <p v-if="typingLabel" class="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground">
      <span class="flex gap-0.5">
        <span
          class="h-1 w-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]"
        />
        <span
          class="h-1 w-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]"
        />
        <span class="h-1 w-1 animate-bounce rounded-full bg-muted-foreground" />
      </span>
      {{ typingLabel }}
    </p>

    <div
      v-if="replyingTo"
      class="mb-1 flex items-center gap-2 rounded-t-lg border border-b-0 bg-primary/5 px-3 py-1.5 text-xs text-muted-foreground"
    >
      <Icon name="lucide:reply" size="12" class="text-primary" />
      <span
        >Replying to <span class="font-semibold text-foreground">{{ replyingTo }}</span></span
      >
      <button
        type="button"
        class="ml-auto font-medium text-primary hover:underline"
        @click="emit('cancelReply')"
      >
        Cancel
      </button>
    </div>

    <div
      v-if="editingMessageId"
      class="mb-1 flex items-center gap-2 rounded-t-lg border border-b-0 bg-accent/50 px-3 py-1.5 text-xs text-muted-foreground"
    >
      <Icon name="lucide:pencil" size="12" />
      <span>Editing message</span>
      <button
        type="button"
        class="ml-auto font-medium text-primary hover:underline"
        @click="cancelEdit"
      >
        Cancel
      </button>
    </div>

    <div
      class="overflow-hidden rounded-lg border focus-within:ring-1 focus-within:ring-ring"
      :class="[editingMessageId || replyingTo ? 'rounded-t-none' : '']"
    >
      <LexicalComposer :initial-config="initialConfig">
        <ComposerToolbar v-if="isRichMode" @send="send" />
        <RichTextPlugin>
          <template #contentEditable>
            <div class="relative" @keydown="handleKeydown">
              <ContentEditable
                class="relative max-h-[128px] min-h-[36px] scrollbar-thin overflow-y-auto px-3 py-2.5 outline-none focus:outline-none"
              >
                <template #placeholder>
                  <span
                    class="pointer-events-none absolute inset-0 px-3 py-2.5 text-sm text-muted-foreground select-none"
                  >
                    {{ placeholder ?? (editingMessageId ? "Edit message..." : "Message #general") }}
                  </span>
                </template>
              </ContentEditable>
            </div>
          </template>
        </RichTextPlugin>
        <HistoryPlugin />
        <ListPlugin v-if="isRichMode" />
        <LinkPlugin v-if="isRichMode" />
        <MarkdownShortcutPlugin
          v-if="isRichMode"
          :transformers="[...ELEMENT_TRANSFORMERS, ...TEXT_FORMAT_TRANSFORMERS]"
        />
        <OnChangePlugin @change="onChange" />
        <CodeHighlightPlugin :enabled="isRichMode" />
        <MentionsPlugin
          v-if="!disableMentions"
          :members="members"
          :current-member-id="currentMemberId ?? ''"
          :channels="channels"
        />
        <div class="flex items-center justify-between px-2 pt-1 pb-2">
          <div class="flex items-center gap-1">
            <ActionTooltip :label="isRichMode ? 'Plain text' : 'Formatting'" side="top">
              <Button
                variant="ghost"
                size="icon-xs"
                :class="{ 'bg-accent text-accent-foreground': isRichMode }"
                @click="toggleRichMode"
              >
                <Icon name="lucide:sigma" size="16" />
              </Button>
            </ActionTooltip>
            <ActionTooltip label="Add reaction" side="top">
              <Button variant="ghost" size="icon-xs">
                <Icon name="lucide:smile-plus" size="16" />
              </Button>
            </ActionTooltip>
            <ActionTooltip label="Attach file" side="top">
              <Button variant="ghost" size="icon-xs">
                <Icon name="lucide:paperclip" size="16" />
              </Button>
            </ActionTooltip>
            <ActionTooltip label="Record audio" side="top">
              <Button variant="ghost" size="icon-xs">
                <Icon name="lucide:mic" size="16" />
              </Button>
            </ActionTooltip>
          </div>
          <ActionTooltip label="Send message" side="top">
            <Button size="icon-xs" @click="send">
              <Icon name="lucide:send" size="14" />
            </Button>
          </ActionTooltip>
        </div>
      </LexicalComposer>
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
