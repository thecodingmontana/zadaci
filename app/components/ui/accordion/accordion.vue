import { RekaAccordionRoot } from "reka-ui";
<script setup lang="ts">
import type { AccordionRootEmits, AccordionRootProps } from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<AccordionRootProps>();
const emits = defineEmits<AccordionRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <RekaAccordionRoot v-slot="slotProps" data-slot="accordion" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </RekaAccordionRoot>
</template>
