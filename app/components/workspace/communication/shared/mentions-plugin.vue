<script setup lang="ts">
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
  }>(),
  { currentMemberId: "" },
);

const MENTION_TRIGGER_REGEX = /(^|\s)@(\w*)$/;

interface MemberInfo {
  id: string;
  name: string;
  avatar: string | null;
}

const editor = useLexicalComposer();
const isOpen = ref(false);
const query = ref("");
const anchorRect = ref<DOMRect | null>(null);

const memberList = computed<MemberInfo[]>(() => {
  if (!props.members) return [];
  return Array.from(props.members.entries())
    .filter(([id]) => id !== props.currentMemberId)
    .map(([id, info]) => ({ id, name: info.name, avatar: info.avatar }));
});

const filteredMembers = computed(() => {
  if (!query.value) return memberList.value;
  const q = query.value.toLowerCase();
  return memberList.value.filter((m) => m.name.toLowerCase().includes(q));
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
    const match = MENTION_TRIGGER_REGEX.exec(textBeforeCursor);
    if (match) {
      query.value = match[2];
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

function insertMention(member: MemberInfo) {
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    const anchorNode = selection.anchor.getNode();
    if (!$isTextNode(anchorNode)) return;
    const textContent = anchorNode.getTextContent();
    const match = MENTION_TRIGGER_REGEX.exec(textContent.slice(0, selection.anchor.offset));
    if (!match) return;
    const mentionStartOffset = selection.anchor.offset - match[0].length + match[1].length;
    const [, , afterSplit] = anchorNode.splitText(mentionStartOffset, selection.anchor.offset);
    const mentionNode = $createMentionNode(member.name, member.id);
    if (afterSplit) {
      afterSplit.replace(mentionNode);
    } else {
      anchorNode.insertAfter(mentionNode);
    }
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
        <CommandInput :model-value="query" placeholder="Search members..." />
        <CommandList>
          <CommandEmpty>No members found</CommandEmpty>
          <CommandGroup heading="Members">
            <CommandItem
              v-for="member in filteredMembers"
              :key="member.id"
              :value="member.name"
              @select="insertMention(member)"
            >
              <Avatar class="mr-2 h-5 w-5">
                <AvatarImage :src="member.avatar ?? ''" :alt="member.name" />
                <AvatarFallback class="text-[9px]">{{
                  (member.name[0] ?? "?").toUpperCase()
                }}</AvatarFallback>
              </Avatar>
              {{ member.name }}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
