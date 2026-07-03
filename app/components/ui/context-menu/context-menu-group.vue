<script setup lang="ts">
import type { ContextMenuGroupProps } from "reka-ui";

const _props = defineProps<ContextMenuGroupProps>();
</script>

<template>
  <ContextMenuGroup
    data-slot="context-menu-group"
    v-bind="props"
  >
    <slot />
  </ContextMenuGroup>
</template>
