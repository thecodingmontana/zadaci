<script setup lang="ts">
import type { DialogTriggerProps } from "reka-ui";

const _props = defineProps<DialogTriggerProps>();
</script>

<template>
  <DialogTrigger
    data-slot="dialog-trigger"
    v-bind="props"
  >
    <slot />
  </DialogTrigger>
</template>
