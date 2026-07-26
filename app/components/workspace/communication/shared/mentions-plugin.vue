<script setup lang="ts">
import type { MentionType } from "./mention-node";
import { $createTextNode, $getSelection, $isRangeSelection, $isTextNode } from "lexical";
import { useLexicalComposer } from "lexical-vue/LexicalComposer";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { $createMentionNode } from "./mention-node";

const props = withDefaults(
  defineProps<{
    members?: Map<string, { name: string; avatar: string | null }>;
    currentMemberId?: string;
    channels?: Map<string, { name: string }>;
  }>(),
  { currentMemberId: "" },
);

const MENTION_TRIGGER = /(^|\s)(@|#)(\w*)$/;

interface Suggestion {
  id: string;
  name: string;
  avatar: string | null;
  type: MentionType;
}

const editor = useLexicalComposer();
const isOpen = ref(false);
const query = ref("");
const triggerChar = ref<"@" | "#">("@");
const anchorRect = ref<DOMRect | null>(null);

const memberList = computed<Suggestion[]>(() => {
  if (!props.members) return [];
  return Array.from(props.members.entries())
    .filter(([id]) => id !== props.currentMemberId)
    .map(([id, info]) => ({ id, name: info.name, avatar: info.avatar, type: "user" as const }));
});

const channelList = computed<Suggestion[]>(() => {
  if (!props.channels) return [];
  return Array.from(props.channels.entries()).map(([id, info]) => ({
    id,
    name: info.name,
    avatar: null,
    type: "channel" as const,
  }));
});

const suggestions = computed<Suggestion[]>(() => {
  if (triggerChar.value === "#") return channelList.value;
  return memberList.value;
});

const filteredSuggestions = computed(() => {
  if (!query.value) return suggestions.value;
  const q = query.value.toLowerCase();
  return suggestions.value.filter((s) => s.name.toLowerCase().includes(q));
});

const anchorStyle = computed(() => {
  const r = anchorRect.value;
  if (!r) return { display: "none" };
  return {
    position: "fixed" as const,
    top: `${r.bottom}px`,
    left: `${r.left}px`,
    width: "0",
    height: "0",
  };
});

function checkForMentionTrigger() {
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
      isOpen.value = false;
      return;
    }
    const anchorNode = selection.anchor.getNode();
    if (!$isTextNode(anchorNode)) {
      isOpen.value = false;
      return;
    }
    const textBeforeCursor = anchorNode.getTextContent().slice(0, selection.anchor.offset);
    const match = MENTION_TRIGGER.exec(textBeforeCursor);
    if (match) {
      const char = match[2] as "@" | "#";
      if (char === "#" && !channelList.value.length) {
        isOpen.value = false;
        return;
      }
      triggerChar.value = char;
      query.value = match[3];
      isOpen.value = true;
      const domSelection = window.getSelection();
      if (domSelection && domSelection.rangeCount > 0) {
        const range = domSelection.getRangeAt(0).cloneRange();
        anchorRect.value = range.getBoundingClientRect();
      }
    } else {
      isOpen.value = false;
    }
  });
}

const unregisterListener = editor.registerUpdateListener(() => {
  checkForMentionTrigger();
});

onUnmounted(() => {
  unregisterListener();
});

function insertMention(suggestion: Suggestion) {
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    const anchorNode = selection.anchor.getNode();
    if (!$isTextNode(anchorNode)) return;
    const textContent = anchorNode.getTextContent();
    const match = MENTION_TRIGGER.exec(textContent.slice(0, selection.anchor.offset));
    if (!match) return;
    const mentionStartOffset = selection.anchor.offset - match[0].length + match[1].length;
    const splitNodes = anchorNode.splitText(mentionStartOffset, selection.anchor.offset);
    const mentionText = splitNodes[1];
    if (!$isTextNode(mentionText)) return;
    const trigger = match[2] === "#" ? "#" : "@";
    const mentionNode = $createMentionNode(suggestion.type, suggestion.name, suggestion.id);
    mentionText.replace(mentionNode);
    const prefix = $createTextNode(trigger);
    mentionNode.insertBefore(prefix);
    mentionNode.insertAfter($createTextNode(" "));
    mentionNode.selectNext();
  });
  isOpen.value = false;
  query.value = "";
}
</script>

<template>
  <Popover :open="isOpen">
    <PopoverTrigger as-child>
      <div :style="anchorStyle" />
    </PopoverTrigger>
    <PopoverContent class="w-64 p-0" align="start">
      <Command>
        <CommandInput :model-value="query" placeholder="Search..." />
        <CommandList>
          <CommandEmpty>No results found</CommandEmpty>
          <CommandGroup v-if="filteredSuggestions.length" heading="Suggestions">
            <CommandItem
              v-for="s in filteredSuggestions"
              :key="`${s.type}-${s.id}`"
              :value="s.name"
              @select="insertMention(s)"
            >
              <Avatar v-if="s.type === 'user'" class="mr-2 h-5 w-5">
                <AvatarImage :src="s.avatar ?? ''" :alt="s.name" />
                <AvatarFallback class="text-[9px]">{{
                  (s.name[0] ?? "?").toUpperCase()
                }}</AvatarFallback>
              </Avatar>
              <span v-else class="mr-2 text-brand">#</span>
              {{ s.name }}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
