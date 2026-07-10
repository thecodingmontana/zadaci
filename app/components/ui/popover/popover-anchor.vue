<script setup lang="ts">
import type { PopoverAnchorProps } from "reka-ui";
import { RekaPopoverAnchor } from "reka-ui";

const props = defineProps<PopoverAnchorProps>();
</script>

<template>
  <RekaPopoverAnchor data-slot="popover-anchor" v-bind="props">
    <slot />
  </RekaPopoverAnchor>
</template>
