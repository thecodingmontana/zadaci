<script setup lang="ts">
import type { MenubarRadioGroupEmits, MenubarRadioGroupProps } from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<MenubarRadioGroupProps>();
const emits = defineEmits<MenubarRadioGroupEmits>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <MenubarRadioGroup
    data-slot="menubar-radio-group"
    v-bind="forwarded"
  >
    <slot />
  </MenubarRadioGroup>
</template>
