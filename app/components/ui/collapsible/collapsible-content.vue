<script setup lang="ts">
import type { CollapsibleContentProps } from "reka-ui";

const _props = defineProps<CollapsibleContentProps>();
</script>

<template>
  <CollapsibleContent
    data-slot="collapsible-content"
    v-bind="props"
  >
    <slot />
  </CollapsibleContent>
</template>
