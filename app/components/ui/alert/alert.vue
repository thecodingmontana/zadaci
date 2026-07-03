<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import type { AlertVariants } from ".";

const _props = defineProps<{
  class?: HTMLAttributes["class"];
  variant?: AlertVariants["variant"];
}>();
</script>

<template>
  <div
    data-slot="alert"
    :class="cn(alertVariants({ variant }), props.class)"
    role="alert"
  >
    <slot />
  </div>
</template>
