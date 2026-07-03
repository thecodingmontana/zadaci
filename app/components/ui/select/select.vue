<script setup lang="ts">
import type { SelectRootEmits, SelectRootProps } from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<SelectRootProps>();
const emits = defineEmits<SelectRootEmits>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <SelectRoot
    v-slot="slotProps"
    data-slot="select"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </SelectRoot>
</template>
