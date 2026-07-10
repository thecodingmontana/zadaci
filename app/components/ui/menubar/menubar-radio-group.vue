<script setup lang="ts">
import type { MenubarRadioGroupEmits, MenubarRadioGroupProps } from "reka-ui";
import { RekaMenubarRadioGroup, useForwardPropsEmits } from "reka-ui";

const props = defineProps<MenubarRadioGroupProps>();
const emits = defineEmits<MenubarRadioGroupEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <RekaMenubarRadioGroup data-slot="menubar-radio-group" v-bind="forwarded">
    <slot />
  </RekaMenubarRadioGroup>
</template>
