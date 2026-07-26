<script setup lang="ts">
import type { EditorState, LexicalEditor } from "lexical";
import { $createParagraphNode, $createTextNode, $getRoot } from "lexical";
import { LexicalComposer } from "lexical-vue/LexicalComposer";
import { ContentEditable } from "lexical-vue/LexicalContentEditable";
import { HistoryPlugin } from "lexical-vue/LexicalHistoryPlugin";
import { OnChangePlugin } from "lexical-vue/LexicalOnChangePlugin";
import { RichTextPlugin } from "lexical-vue/LexicalRichTextPlugin";
import ComposerToolbar from "./composer-toolbar.vue";

const props = defineProps<{
  typingLabel?: string;
  placeholder?: string;
  editingMessageId?: string | null;
  editingContent?: string;
  replyingTo?: string | null;
}>();
const emit = defineEmits<{
  send: [content: string];
  cancelEdit: [];
  cancelReply: [];
  typing: [];
}>();

const contentText = ref("");
const editorRef = ref<LexicalEditor | null>(null);
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
  },
  onError: (error: Error) => {
    console.error("Lexical error:", error);
  },
};

function onChange(editorState?: any, editor?: any) {
  editorRef.value = editor as LexicalEditor;
  contentText.value = (editorState as EditorState).read(() => $getRoot().getTextContent());
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
}

function cancelEdit() {
  contentText.value = "";
  emit("cancelEdit");
}

function onCancelReply() {
  emit("cancelReply");
}

watch(
  [() => props.editingContent, () => props.editingMessageId, editorRef],
  ([content, msgId, editor]) => {
    if (content && msgId && editor) {
      editor.update(() => {
        $getRoot().clear();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(content));
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
        @click="onCancelReply"
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
        <RichTextPlugin>
          <template #contentEditable>
            <ContentEditable
              class="prose prose-sm max-h-[128px] min-h-[36px] scrollbar-thin overflow-y-auto px-3 py-2.5 outline-none focus:outline-none"
            >
              <template #placeholder>
                <div
                  class="pointer-events-none absolute top-2.5 left-3 text-sm text-muted-foreground select-none"
                >
                  {{ placeholder ?? (editingMessageId ? "Edit message..." : "Message #general") }}
                </div>
              </template>
            </ContentEditable>
          </template>
        </RichTextPlugin>
        <HistoryPlugin />
        <OnChangePlugin @change="onChange" />
        <ComposerToolbar @send="send" />
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
