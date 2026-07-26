<script setup lang="ts">
import { $getSelection, $isRangeSelection } from "lexical";
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
import { Popover, PopoverContent } from "~/components/ui/popover";
import { $createMentionNode } from "./mention-node";

interface MemberInfo {
  id: string;
  name: string;
  avatar: string | null;
}

const props = withDefaults(
  defineProps<{
    members?: Map<string, { name: string; avatar: string | null }>;
    currentMemberId?: string;
  }>(),
  { currentMemberId: "" },
);

const editor = useLexicalComposer();
const open = ref(false);
const query = ref("");

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

const unregisterListener = editor.registerUpdateListener(() => {
  const rootEl = editor.getRootElement();
  if (!rootEl) return;

  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      if (open.value) open.value = false;
      return;
    }
    const text = selection.getTextContent();
    const anchor = selection.anchor;
    if (!anchor || !anchor.getNode()) {
      if (open.value) open.value = false;
      return;
    }
    const offset = anchor.offset;
    const before = text.slice(0, offset);
    const atIdx = before.lastIndexOf("@");
    if (atIdx === -1 || (atIdx > 0 && before[atIdx - 1] !== " " && before[atIdx - 1] !== "\n")) {
      if (open.value) open.value = false;
      return;
    }
    query.value = before.slice(atIdx + 1);
    if (query.value.length > 0 && !filteredMembers.value.length) {
      if (open.value) open.value = false;
      return;
    }
    open.value = true;
  });
});

onUnmounted(() => {
  unregisterListener();
});

function selectMember(member: MemberInfo) {
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    const anchor = selection.anchor;
    const node = anchor.getNode();
    if (!node || !node.isAttached()) return;
    const text = node.getTextContent();
    const offset = anchor.offset;
    const before = text.slice(0, offset);
    const atIdx = before.lastIndexOf("@");
    if (atIdx === -1) return;

    const splitNodes = node.splitText(atIdx, offset);
    const queryNode = splitNodes[1];
    if (queryNode) {
      queryNode.remove();
    }
    const mentionNode = $createMentionNode(member.id, member.name);
    if (splitNodes[0]) {
      splitNodes[0].insertAfter(mentionNode);
    } else {
      node.insertBefore(mentionNode);
    }
    mentionNode.selectEnd();
  });
  open.value = false;
  query.value = "";
}
</script>

<template>
  <Popover :open="open">
    <PopoverContent
      side="top"
      :side-offset="5"
      align="start"
      class="w-72 p-0"
      @pointer-down-outside="open = false"
      @escape-key-down="open = false"
    >
      <Command>
        <CommandInput v-model="query" placeholder="Search members..." class="h-9" />
        <CommandList>
          <CommandEmpty>No members found</CommandEmpty>
          <CommandGroup heading="Members">
            <CommandItem
              v-for="member in filteredMembers"
              :key="member.id"
              :value="member.name"
              @select="selectMember(member)"
            >
              <Avatar class="mr-2 h-5 w-5">
                <AvatarImage :src="member.avatar ?? ''" :alt="member.name" />
                <AvatarFallback class="text-[9px]">{{
                  (member.name[0] ?? "?").toUpperCase()
                }}</AvatarFallback>
              </Avatar>
              <span>{{ member.name }}</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
