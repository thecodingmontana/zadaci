<script lang="ts" setup>
import type { DrawerRootEmits, DrawerRootProps } from "vaul-vue";
import { useForwardPropsEmits } from "reka-ui";
import { VaulDrawerRoot } from "vaul-vue";

const props = withDefaults(defineProps<DrawerRootProps>(), {
  shouldScaleBackground: true,
});

const emits = defineEmits<DrawerRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <VaulDrawerRoot v-slot="slotProps" data-slot="drawer" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </VaulDrawerRoot>
</template>
