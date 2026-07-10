import { RekaAlertDialogRoot } from "reka-ui";
<script setup lang="ts">
import type { AlertDialogEmits, AlertDialogProps } from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<AlertDialogProps>();
const emits = defineEmits<AlertDialogEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <RekaAlertDialogRoot v-slot="slotProps" data-slot="alert-dialog" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </RekaAlertDialogRoot>
</template>
