<script setup lang="ts">
import type { ContextMenuPortalProps } from "reka-ui";

const _props = defineProps<ContextMenuPortalProps>();
</script>

<template>
  <ContextMenuPortal
    data-slot="context-menu-portal"
    v-bind="props"
  >
    <slot />
  </ContextMenuPortal>
</template>
