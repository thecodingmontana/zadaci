<script setup lang="ts">
import type { DialogRootEmits, DialogRootProps } from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<DialogRootProps>();
const emits = defineEmits<DialogRootEmits>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DialogRoot
    v-slot="slotProps"
    data-slot="sheet"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </DialogRoot>
</template>
