<script setup lang="ts">
import type { EmojiPickerEmoji } from "vue-frimousse";
import EmojiPicker from "vue-frimousse";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

const emit = defineEmits<{ select: [emoji: string] }>();
const open = defineModel<boolean>("open", { default: false });

function onEmojiSelect(emoji: EmojiPickerEmoji) {
  emit("select", emoji.emoji);
  open.value = false;
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <slot>
        <Button variant="ghost" size="icon-xs" aria-label="Add emoji">
          <Icon name="lucide:smile-plus" size="16" />
        </Button>
      </slot>
    </PopoverTrigger>
    <PopoverContent class="w-[320px] p-0" align="start">
      <EmojiPicker.Root
        :on-emoji-select="onEmojiSelect"
        :columns="8"
        class="flex h-[340px] w-full flex-col"
      >
        <EmojiPicker.Search
          placeholder="Search emoji..."
          class="mx-2 mt-2 rounded-md border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <EmojiPicker.Viewport class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <EmojiPicker.Loading
            class="flex h-full items-center justify-center text-xs text-muted-foreground"
          >
            Loading…
          </EmojiPicker.Loading>
          <EmojiPicker.Empty
            class="flex h-full items-center justify-center text-xs text-muted-foreground"
          >
            No emoji found.
          </EmojiPicker.Empty>
          <EmojiPicker.List
            :components="{
              CategoryHeader: ({ category }: any) =>
                h(
                  'div',
                  {
                    class:
                      'sticky top-0 z-10 bg-popover px-1 pb-1 pt-2 text-xs font-medium text-muted-foreground',
                  },
                  category.label,
                ),
              Row: ({ children, ...props }: any) =>
                h('div', { class: 'flex gap-0.5', ...props }, children),
              Emoji: ({ emoji, ...props }: any) =>
                h(
                  'button',
                  {
                    class:
                      'flex aspect-square h-8 w-8 items-center justify-center rounded-md text-lg data-[active]:bg-accent',
                    ...props,
                  },
                  emoji.emoji,
                ),
            }"
          />
        </EmojiPicker.Viewport>
      </EmojiPicker.Root>
    </PopoverContent>
  </Popover>
</template>
