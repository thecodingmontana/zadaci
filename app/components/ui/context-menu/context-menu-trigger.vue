<script setup lang="ts">
import type { ContextMenuTriggerProps } from "reka-ui";
import { useForwardProps } from "reka-ui";

const props = defineProps<ContextMenuTriggerProps>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwardedProps = useForwardProps(props);
</script>

<template>
  <ContextMenuTrigger
    data-slot="context-menu-trigger"
    v-bind="forwardedProps"
  >
    <slot />
  </ContextMenuTrigger>
</template>
