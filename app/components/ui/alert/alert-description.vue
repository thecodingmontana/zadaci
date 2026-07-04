<script setup lang="ts">
import type { HTMLAttributes } from "vue";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <div
    data-slot="alert-description"
    :class="cn('col-start-2 text-sm text-muted-foreground [&_p]:leading-relaxed', props.class)"
  >
    <slot />
  </div>
</template>
