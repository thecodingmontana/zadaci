<script setup lang="ts">
import type { ComboboxRootEmits, ComboboxRootProps } from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<ComboboxRootProps>();
const emits = defineEmits<ComboboxRootEmits>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <ComboboxRoot
    v-slot="slotProps"
    data-slot="combobox"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </ComboboxRoot>
</template>
