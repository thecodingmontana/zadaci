<script setup lang="ts">
import type { SplitterPanelEmits, SplitterPanelProps } from "reka-ui";
import { useForwardExpose, useForwardPropsEmits } from "reka-ui";

const props = defineProps<SplitterPanelProps>();
const emits = defineEmits<SplitterPanelEmits>();

const forwarded = useForwardPropsEmits(props, emits);

const { forwardRef: _forwardRef } = useForwardExpose();
</script>

<template>
  <SplitterPanel
    :ref="_forwardRef"
    v-slot="slotProps"
    data-slot="resizable-panel"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </SplitterPanel>
</template>
