<script setup lang="ts">
import type { PopoverRootEmits, PopoverRootProps } from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<PopoverRootProps>();
const emits = defineEmits<PopoverRootEmits>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <PopoverRoot
    v-slot="slotProps"
    data-slot="popover"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </PopoverRoot>
</template>
