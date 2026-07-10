<script setup lang="ts">
import type { PopoverTriggerProps } from "reka-ui";
import { RekaPopoverTrigger } from "reka-ui";

const props = defineProps<PopoverTriggerProps>();
</script>

<template>
  <RekaPopoverTrigger data-slot="popover-trigger" v-bind="props">
    <slot />
  </RekaPopoverTrigger>
</template>
