<script lang="ts" setup>
import type { DrawerTriggerProps } from "vaul-vue";
import { DrawerTrigger as VaulDrawerTrigger } from "vaul-vue";

const props = defineProps<DrawerTriggerProps>();
</script>

<template>
  <VaulDrawerTrigger data-slot="drawer-trigger" v-bind="props">
    <slot />
  </VaulDrawerTrigger>
</template>
