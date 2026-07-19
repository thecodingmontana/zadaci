<script setup lang="ts">
import EmojiPicker from "~/components/workspace/channels/emoji-picker.vue";

defineProps<{ typingLabel?: string; placeholder?: string }>();
const emit = defineEmits<{ send: [content: string] }>();
const content = ref("");
const textareaRef = ref<HTMLTextAreaElement>();

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

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
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

    <div class="rounded-lg border focus-within:ring-1 focus-within:ring-ring">
      <textarea
        ref="textareaRef"
        v-model="content"
        rows="1"
        :placeholder="placeholder ?? 'Message #general'"
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
