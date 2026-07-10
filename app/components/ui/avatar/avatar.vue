<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { RekaAvatarRoot } from "reka-ui";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <RekaAvatarRoot
    data-slot="avatar"
    :class="cn('relative flex size-8 shrink-0 overflow-hidden rounded-full', props.class)"
  >
    <slot />
  </RekaAvatarRoot>
</template>
