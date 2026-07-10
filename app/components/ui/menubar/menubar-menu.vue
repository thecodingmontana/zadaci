<script setup lang="ts">
import type { MenubarMenuProps } from "reka-ui";
import { RekaMenubarMenu } from "reka-ui";

const props = defineProps<MenubarMenuProps>();
</script>

<template>
  <RekaMenubarMenu data-slot="menubar-menu" v-bind="props">
    <slot />
  </RekaMenubarMenu>
</template>
