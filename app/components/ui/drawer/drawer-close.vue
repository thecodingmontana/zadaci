<script lang="ts" setup>
import type { DrawerCloseProps } from "vaul-vue";
import { DrawerClose as VaulDrawerClose } from "vaul-vue";

const props = defineProps<DrawerCloseProps>();
</script>

<template>
  <VaulDrawerClose data-slot="drawer-close" v-bind="props">
    <slot />
  </VaulDrawerClose>
</template>
