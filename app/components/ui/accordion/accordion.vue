<script setup lang="ts">
import type { AccordionRootEmits, AccordionRootProps } from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<AccordionRootProps>();
const emits = defineEmits<AccordionRootEmits>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <AccordionRoot v-slot="slotProps" data-slot="accordion" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </AccordionRoot>
</template>
