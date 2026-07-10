<script lang="ts" setup>
import type { StepperTriggerProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { RekaStepperTrigger, useForwardProps } from "reka-ui";

const props = defineProps<StepperTriggerProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = reactiveOmit(props, "class");

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <RekaStepperTrigger
    v-bind="forwarded"
    :class="cn('flex flex-col items-center gap-1 rounded-md p-1 text-center', props.class)"
  >
    <slot />
  </RekaStepperTrigger>
</template>
