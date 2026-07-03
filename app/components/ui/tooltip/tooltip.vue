<script setup lang="ts">
import type { TooltipRootEmits, TooltipRootProps } from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<TooltipRootProps>();
const emits = defineEmits<TooltipRootEmits>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <TooltipRoot
    v-slot="slotProps"
    data-slot="tooltip"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </TooltipRoot>
</template>
