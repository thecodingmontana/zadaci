<script setup lang="ts">
import type { AlertDialogTriggerProps } from "reka-ui";

const _props = defineProps<AlertDialogTriggerProps>();
</script>

<template>
  <AlertDialogTrigger data-slot="alert-dialog-trigger" v-bind="props">
    <slot />
  </AlertDialogTrigger>
</template>
