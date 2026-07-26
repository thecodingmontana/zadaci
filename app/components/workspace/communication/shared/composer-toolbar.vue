<script setup lang="ts">
import { $createCodeHighlightNode, $createCodeNode } from "@lexical/code";
import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { $createQuoteNode } from "@lexical/rich-text";
import {
  $findMatchingParent,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
} from "lexical";
import { useLexicalComposer } from "lexical-vue/LexicalComposer";
import { Button } from "~/components/ui/button";
import ActionTooltip from "~/components/workspace/shared/action-tooltip.vue";

const editor = useLexicalComposer();
const isBold = ref(false);
const isItalic = ref(false);
const isUnderline = ref(false);
const isStrikethrough = ref(false);

const unregisterListener = editor.registerUpdateListener(
  ({ editorState }: { editorState: any }) => {
    editorState.read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        isBold.value = selection.hasFormat("bold");
        isItalic.value = selection.hasFormat("italic");
        isUnderline.value = selection.hasFormat("underline");
        isStrikethrough.value = selection.hasFormat("strikethrough");
      }
    });
  },
);

onUnmounted(() => {
  unregisterListener();
});

function toggleFormat(format: "bold" | "italic" | "underline" | "strikethrough") {
  editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
}

function insertList(type: "ordered" | "unordered") {
  if (type === "ordered") {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  } else {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  }
}

function getBlockNode() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const anchor = selection.anchor.getNode();
  return (
    $findMatchingParent(anchor, (n) => $isElementNode(n) && n.getType() !== "root") ??
    anchor.getTopLevelElement()
  );
}

function insertBlockquote() {
  editor.update(() => {
    const block = getBlockNode();
    if (!block) return;
    const quote = $createQuoteNode();
    quote.setFormat(block.getFormatType());
    const children = block.getChildren();
    for (const child of children) {
      quote.append(child);
    }
    block.replace(quote);
    quote.selectEnd();
  });
}

function insertLink() {
  // eslint-disable-next-line no-alert
  const url = window.prompt("Enter URL:");
  if (url) {
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
  }
}

function insertCodeBlock() {
  editor.update(() => {
    const block = getBlockNode();
    if (!block) return;
    const text = block.getTextContent();
    const codeNode = $createCodeNode();
    if (text) {
      codeNode.append($createCodeHighlightNode(text));
    }
    block.replace(codeNode);
    codeNode.selectEnd();
  });
}
</script>

<template>
  <div class="flex items-center gap-0.5 border-b px-2 py-1.5">
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
    <span class="mx-1 h-4 w-px bg-border" />
    <ActionTooltip label="Ordered list" side="top">
      <Button variant="ghost" size="icon-xs" @click="insertList('ordered')">
        <Icon name="lucide:list-ordered" size="14" />
      </Button>
    </ActionTooltip>
    <ActionTooltip label="Unordered list" side="top">
      <Button variant="ghost" size="icon-xs" @click="insertList('unordered')">
        <Icon name="lucide:list" size="14" />
      </Button>
    </ActionTooltip>
    <span class="mx-1 h-4 w-px bg-border" />
    <ActionTooltip label="Blockquote" side="top">
      <Button variant="ghost" size="icon-xs" @click="insertBlockquote">
        <Icon name="lucide:quote" size="14" />
      </Button>
    </ActionTooltip>
    <ActionTooltip label="Code" side="top">
      <Button variant="ghost" size="icon-xs" @click="insertCodeBlock">
        <Icon name="lucide:code" size="14" />
      </Button>
    </ActionTooltip>
    <ActionTooltip label="Link" side="top">
      <Button variant="ghost" size="icon-xs" @click="insertLink">
        <Icon name="lucide:link" size="14" />
      </Button>
    </ActionTooltip>
  </div>
</template>
