<script setup lang="ts">
import EmojiPicker from "~/components/workspace/communication/shared/emoji-picker.vue";

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
}>();
const content = ref("");
const textareaRef = ref<HTMLTextAreaElement>();

watch(
  () => props.editingContent,
  (val) => {
    if (val && props.editingMessageId) {
      content.value = val;
      nextTick(() => {
        textareaRef.value?.focus();
        textareaRef.value?.setSelectionRange(content.value.length, content.value.length);
      });
    }
  },
  { immediate: true },
);

watch(
  () => props.editingMessageId,
  () => {},
  { immediate: true },
);

function insertEmoji(emoji: string) {
  content.value += emoji;
  nextTick(() => textareaRef.value?.focus());
}

function send() {
  const value = content.value.trim();
  if (!value) return;
  emit("send", value);
  content.value = "";
}

function cancelEdit() {
  content.value = "";
  emit("cancelEdit");
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
  if (e.key === "Escape" && props.editingMessageId) {
    cancelEdit();
  }
}
</script>

<template>
  <div class="border-t px-4 py-3">
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
      class="rounded-lg border focus-within:ring-1 focus-within:ring-ring"
      :class="[editingMessageId || replyingTo ? 'rounded-t-none' : '']"
    >
      <textarea
        ref="textareaRef"
        v-model="content"
        rows="1"
        :placeholder="placeholder ?? (editingMessageId ? 'Edit message...' : 'Message #general')"
        class="max-h-40 w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none"
        @keydown="onKeydown"
      />
      <div class="flex items-center justify-between px-2 pb-2">
        <div class="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" aria-label="Text formatting">
            <Icon name="lucide:type" size="16" />
          </Button>
          <EmojiPicker @select="insertEmoji" />
          <Button variant="ghost" size="icon-xs" aria-label="Attach file">
            <Icon name="lucide:paperclip" size="16" />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="Record audio">
            <Icon name="lucide:mic" size="16" />
          </Button>
        </div>
        <Button size="icon-xs" :disabled="!content.trim()" aria-label="Send message" @click="send">
          <Icon name="lucide:send" size="14" />
        </Button>
      </div>
    </div>
  </div>
</template>
