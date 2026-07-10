<script setup lang="ts">
import type { ContextMenuTriggerProps } from "reka-ui";
import { RekaContextMenuTrigger, useForwardProps } from "reka-ui";

const props = defineProps<ContextMenuTriggerProps>();

const forwardedProps = useForwardProps(props);
</script>

<template>
  <RekaContextMenuTrigger data-slot="context-menu-trigger" v-bind="forwardedProps">
    <slot />
  </RekaContextMenuTrigger>
</template>
