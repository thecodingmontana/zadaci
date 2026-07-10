<script setup lang="ts">
import type { HoverCardRootEmits, HoverCardRootProps } from "reka-ui";
import { RekaHoverCardRoot, useForwardPropsEmits } from "reka-ui";

const props = defineProps<HoverCardRootProps>();
const emits = defineEmits<HoverCardRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <RekaHoverCardRoot v-slot="slotProps" data-slot="hover-card" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </RekaHoverCardRoot>
</template>
