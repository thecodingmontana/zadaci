<script setup lang="ts">
import type { PopoverTriggerProps } from "reka-ui";

const _props = defineProps<PopoverTriggerProps>();
</script>

<template>
  <PopoverTrigger
    data-slot="popover-trigger"
    v-bind="props"
  >
    <slot />
  </PopoverTrigger>
</template>
