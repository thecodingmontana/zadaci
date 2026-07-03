<script setup lang="ts">
import type { HTMLAttributes } from "vue";

const _props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <thead
    data-slot="table-header"
    :class="cn('[&_tr]:border-b', props.class)"
  >
    <slot />
  </thead>
</template>
