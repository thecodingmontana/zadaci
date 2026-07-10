<script setup lang="ts">
import type { ContextMenuRadioGroupEmits, ContextMenuRadioGroupProps } from "reka-ui";
import { RekaContextMenuRadioGroup, useForwardPropsEmits } from "reka-ui";

const props = defineProps<ContextMenuRadioGroupProps>();
const emits = defineEmits<ContextMenuRadioGroupEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <RekaContextMenuRadioGroup data-slot="context-menu-radio-group" v-bind="forwarded">
    <slot />
  </RekaContextMenuRadioGroup>
</template>
