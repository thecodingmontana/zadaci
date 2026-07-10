<script lang="ts" setup>
import type { StepperTitleProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { RekaStepperTitle, useForwardProps } from "reka-ui";

const props = defineProps<StepperTitleProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = reactiveOmit(props, "class");

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <RekaStepperTitle
    v-bind="forwarded"
    :class="cn('text-md font-semibold whitespace-nowrap', props.class)"
  >
    <slot />
  </RekaStepperTitle>
</template>
