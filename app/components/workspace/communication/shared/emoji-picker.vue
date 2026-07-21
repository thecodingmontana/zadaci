<script setup lang="ts">
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

const emit = defineEmits<{ select: [emoji: string] }>();
const open = defineModel<boolean>("open", { default: false });

function onEmojiSelect(emoji: any) {
  emit("select", emoji.i ?? emoji);
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
    <PopoverContent
      class="z-[100] w-[320px] overflow-hidden rounded-lg border bg-popover p-0 text-popover-foreground shadow-lg"
      align="start"
      :side-offset="8"
    >
      <NuxtEmojiPicker class="!h-[340px] !w-full !bg-popover" @select="onEmojiSelect" />
    </PopoverContent>
  </Popover>
</template>
