<script setup lang="ts">
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
} from "lexical";
import { useLexicalComposer } from "lexical-vue/LexicalComposer";
import EmojiPicker from "~/components/workspace/communication/shared/emoji-picker.vue";

const emit = defineEmits<{
  send: [];
}>();

const editor = useLexicalComposer();
const isBold = ref(false);
const isItalic = ref(false);
const isUnderline = ref(false);
const isStrikethrough = ref(false);

editor.registerUpdateListener(() => {
  const selection = $getSelection();
  if ($isRangeSelection(selection)) {
    isBold.value = selection.hasFormat("bold");
    isItalic.value = selection.hasFormat("italic");
    isUnderline.value = selection.hasFormat("underline");
    isStrikethrough.value = selection.hasFormat("strikethrough");
  }
});

function toggleFormat(format: "bold" | "italic" | "underline" | "strikethrough") {
  editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
}

function insertEmoji(emoji: string) {
  editor.focus();
  editor.update(() => {
    const selection = $getSelection();
    if (selection) {
      const text = $createTextNode(emoji);
      selection.insertNodes([text]);
    } else {
      const root = $getRoot();
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(emoji));
      root.append(paragraph);
    }
  });
}
</script>

<template>
  <div class="flex items-center justify-between px-2 pb-2">
    <div class="flex items-center gap-1">
      <div class="flex items-center gap-0.5">
        <ActionTooltip label="Bold" side="top">
          <Button
            variant="ghost"
            size="icon-xs"
            :class="{ 'bg-accent text-accent-foreground': isBold }"
            @click="toggleFormat('bold')"
          >
            <Icon name="lucide:bold" size="14" />
          </Button>
        </ActionTooltip>
        <ActionTooltip label="Italic" side="top">
          <Button
            variant="ghost"
            size="icon-xs"
            :class="{ 'bg-accent text-accent-foreground': isItalic }"
            @click="toggleFormat('italic')"
          >
            <Icon name="lucide:italic" size="14" />
          </Button>
        </ActionTooltip>
        <ActionTooltip label="Underline" side="top">
          <Button
            variant="ghost"
            size="icon-xs"
            :class="{ 'bg-accent text-accent-foreground': isUnderline }"
            @click="toggleFormat('underline')"
          >
            <Icon name="lucide:underline" size="14" />
          </Button>
        </ActionTooltip>
        <ActionTooltip label="Strikethrough" side="top">
          <Button
            variant="ghost"
            size="icon-xs"
            :class="{ 'bg-accent text-accent-foreground': isStrikethrough }"
            @click="toggleFormat('strikethrough')"
          >
            <Icon name="lucide:strikethrough" size="14" />
          </Button>
        </ActionTooltip>
      </div>
      <ActionTooltip label="Add reaction" side="top">
        <EmojiPicker @select="insertEmoji" />
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
      <Button size="icon-xs" @click="emit('send')">
        <Icon name="lucide:send" size="14" />
      </Button>
    </ActionTooltip>
  </div>
</template>
