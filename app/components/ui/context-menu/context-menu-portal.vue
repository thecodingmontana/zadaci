<script setup lang="ts">
import type { ContextMenuPortalProps } from "reka-ui";
import { RekaContextMenuPortal } from "reka-ui";

const props = defineProps<ContextMenuPortalProps>();
</script>

<template>
  <RekaContextMenuPortal data-slot="context-menu-portal" v-bind="props">
    <slot />
  </RekaContextMenuPortal>
</template>
