<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { NumberFieldInput as RekaNumberFieldInput } from "reka-ui";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <RekaNumberFieldInput
    data-slot="input"
    :class="
      cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent py-1 text-center text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
  />
</template>
