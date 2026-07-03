<script setup lang="ts">
import type { MenubarGroupProps } from "reka-ui";

const _props = defineProps<MenubarGroupProps>();
</script>

<template>
  <MenubarGroup
    data-slot="menubar-group"
    v-bind="props"
  >
    <slot />
  </MenubarGroup>
</template>
