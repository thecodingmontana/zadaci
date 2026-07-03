<script setup lang="ts">
import type { MenubarMenuProps } from "reka-ui";

const _props = defineProps<MenubarMenuProps>();
</script>

<template>
  <MenubarMenu
    data-slot="menubar-menu"
    v-bind="props"
  >
    <slot />
  </MenubarMenu>
</template>
