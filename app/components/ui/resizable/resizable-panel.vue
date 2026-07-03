<script setup lang="ts">
import type { SplitterPanelEmits, SplitterPanelProps } from "reka-ui";
import { useForwardExpose, useForwardPropsEmits } from "reka-ui";

const props = defineProps<SplitterPanelProps>();
const emits = defineEmits<SplitterPanelEmits>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwarded = useForwardPropsEmits(props, emits);
// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
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
