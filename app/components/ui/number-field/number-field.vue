<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import type { NumberFieldRootEmits, NumberFieldRootProps } from "reka-ui";
import { useForwardPropsEmits } from "reka-ui";
import type { HTMLAttributes } from "vue";

const props = defineProps<
  NumberFieldRootProps & { class?: HTMLAttributes["class"] }
>();
const emits = defineEmits<NumberFieldRootEmits>();

const delegatedProps = reactiveOmit(props, "class");

// biome-ignore lint/correctness/useHookAtTopLevel: <script setup> is the component setup function
const _forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <NumberFieldRoot v-slot="slotProps" v-bind="forwarded" :class="cn('grid gap-1.5', props.class)">
    <slot v-bind="slotProps" />
  </NumberFieldRoot>
</template>
