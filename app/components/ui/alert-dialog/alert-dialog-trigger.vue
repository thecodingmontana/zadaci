<script setup lang="ts">
import type { AlertDialogTriggerProps } from "reka-ui";
import { RekaAlertDialogTrigger } from "reka-ui";

const props = defineProps<AlertDialogTriggerProps>();
</script>

<template>
  <RekaAlertDialogTrigger data-slot="alert-dialog-trigger" v-bind="props">
    <slot />
  </RekaAlertDialogTrigger>
</template>
