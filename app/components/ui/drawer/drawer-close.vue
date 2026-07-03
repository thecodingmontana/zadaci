<script lang="ts" setup>
import type { DrawerCloseProps } from "vaul-vue";

const _props = defineProps<DrawerCloseProps>();
</script>

<template>
  <DrawerClose
    data-slot="drawer-close"
    v-bind="props"
  >
    <slot />
  </DrawerClose>
</template>
