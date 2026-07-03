<script setup lang="ts">
import type { AlertDialogEmits, AlertDialogProps } from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<AlertDialogProps>();
const emits = defineEmits<AlertDialogEmits>();

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <AlertDialogRoot v-slot="slotProps" data-slot="alert-dialog" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </AlertDialogRoot>
</template>
