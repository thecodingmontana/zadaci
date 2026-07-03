<script setup lang="ts">
import type { HoverCardRootEmits, HoverCardRootProps } from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<HoverCardRootProps>();
const emits = defineEmits<HoverCardRootEmits>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <HoverCardRoot
    v-slot="slotProps"
    data-slot="hover-card"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </HoverCardRoot>
</template>
