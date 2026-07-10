<script setup lang="ts">
import type { ContextMenuGroupProps } from "reka-ui";
import { RekaContextMenuGroup } from "reka-ui";

const props = defineProps<ContextMenuGroupProps>();
</script>

<template>
  <RekaContextMenuGroup data-slot="context-menu-group" v-bind="props">
    <slot />
  </RekaContextMenuGroup>
</template>
