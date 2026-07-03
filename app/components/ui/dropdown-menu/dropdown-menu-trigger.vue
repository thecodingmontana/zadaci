<script setup lang="ts">
import type { DropdownMenuTriggerProps } from "reka-ui";
import { useForwardProps } from "reka-ui";

const props = defineProps<DropdownMenuTriggerProps>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwardedProps = useForwardProps(props);
</script>

<template>
  <DropdownMenuTrigger
    data-slot="dropdown-menu-trigger"
    v-bind="forwardedProps"
  >
    <slot />
  </DropdownMenuTrigger>
</template>
