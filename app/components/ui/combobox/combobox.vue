import { RekaComboboxRoot } from "reka-ui";
<script setup lang="ts">
import type { ComboboxRootEmits, ComboboxRootProps } from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<ComboboxRootProps>();
const emits = defineEmits<ComboboxRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <RekaComboboxRoot v-slot="slotProps" data-slot="combobox" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </RekaComboboxRoot>
</template>
