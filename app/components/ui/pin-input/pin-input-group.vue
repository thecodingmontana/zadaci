<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import type { PrimitiveProps } from "reka-ui";
import { useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<
  PrimitiveProps & { class?: HTMLAttributes["class"] }
>();
const delegatedProps = reactiveOmit(props, "class");
// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <Primitive
    data-slot="pin-input-group"
    v-bind="forwardedProps"
    :class="cn('flex items-center', props.class)"
  >
    <slot />
  </Primitive>
</template>
