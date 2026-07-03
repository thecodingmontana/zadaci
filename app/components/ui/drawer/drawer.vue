<script lang="ts" setup>
import { useForwardPropsEmits } from "reka-ui";
import type { DrawerRootEmits, DrawerRootProps } from "vaul-vue";

const props = withDefaults(defineProps<DrawerRootProps>(), {
  shouldScaleBackground: true,
});

const emits = defineEmits<DrawerRootEmits>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DrawerRoot
    v-slot="slotProps"
    data-slot="drawer"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </DrawerRoot>
</template>
