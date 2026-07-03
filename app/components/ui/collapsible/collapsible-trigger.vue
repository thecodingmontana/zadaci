<script setup lang="ts">
import type { CollapsibleTriggerProps } from "reka-ui";

const _props = defineProps<CollapsibleTriggerProps>();
</script>

<template>
  <CollapsibleTrigger
    data-slot="collapsible-trigger"
    v-bind="props"
  >
    <slot />
  </CollapsibleTrigger>
</template>
