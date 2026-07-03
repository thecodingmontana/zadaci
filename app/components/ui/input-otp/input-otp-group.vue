<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import { useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();

const delegatedProps = reactiveOmit(props, "class");

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <div
    data-slot="input-otp-group"
    v-bind="forwarded"
    :class="cn('flex items-center', props.class)"
  >
    <slot />
  </div>
</template>
