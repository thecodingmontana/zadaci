<script setup lang="ts">
import type { SelectRootEmits, SelectRootProps } from "reka-ui";
import { RekaSelectRoot, useForwardPropsEmits } from "reka-ui";

const props = defineProps<SelectRootProps>();
const emits = defineEmits<SelectRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <RekaSelectRoot v-slot="slotProps" data-slot="select" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </RekaSelectRoot>
</template>
