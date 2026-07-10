import { RekaPopoverRoot } from "reka-ui";
<script setup lang="ts">
import type { PopoverRootEmits, PopoverRootProps } from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<PopoverRootProps>();
const emits = defineEmits<PopoverRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <RekaPopoverRoot v-slot="slotProps" data-slot="popover" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </RekaPopoverRoot>
</template>
